"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { Prisma, RecommendationRole } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import type {
  ExplanationCaveat,
  ExplanationFactor,
  RotatableCandidate,
} from "@/lib/recommendations/types";
import { tuneContextSchema } from "@/lib/recommendations/types";
import { EXPOSURE_COOLDOWN_DAYS } from "@/lib/recommendations/types";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import { rebuildRecommendationProfile } from "@/lib/recommendations/profile";
import { updatePlayState } from "@/actions/game-detail";
import { runRecommendationPipeline } from "@/lib/recommendations/run-pipeline";
import {
  loadKnownGenreTagValues,
  loadRecommendationPresets,
  resetKnownGenreTagValuesCache as resetKnownGenreTagValuesCacheLoader,
} from "@/lib/recommendations/queries";

type BatchEntry = string | RotatableCandidate;

export async function resetKnownGenreTagValuesCache() {
  await requireUser();
  resetKnownGenreTagValuesCacheLoader();
}

const dismissRecommendationSchema = z
  .object({
    gameId: z.string().trim().min(1).optional(),
    wishlistEntryId: z.string().trim().min(1).optional(),
    kind: z.enum(["PLAY_NEXT", "BUY"]),
    runId: z.string().trim().min(1).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const targets = [value.gameId !== undefined, value.wishlistEntryId !== undefined].filter(
      Boolean,
    ).length;
    if (targets !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one target is required",
      });
    }
  });

const recordRunExposureSchema = z.object({
  runId: z.string().trim().min(1),
  items: z.array(z.object({
    gameId: z.string().trim().min(1).optional(),
    wishlistEntryId: z.string().trim().min(1).optional(),
    role: z.nativeEnum(RecommendationRole).optional(),
  }).strict().superRefine((value, ctx) => {
    if ([value.gameId, value.wishlistEntryId].filter(Boolean).length !== 1) {
      ctx.addIssue({ code: "custom", message: "Exactly one target is required" });
    }
  })),
}).strict();

const recommendationPreferenceSchema = z.object({
  dimension: z.enum(["GENRE", "TAG", "EXPERIENCE", "DURATION", "PUBLISHER", "ERA", "SERIES", "ENVIRONMENT", "MATURITY"]),
  value: z.string().trim().min(1),
  attitude: z.enum(["PREFER", "NEUTRAL", "AVOID"]),
}).strict();

const recommendationPreferenceIdSchema = z.object({ id: z.string().trim().min(1) }).strict();

function toNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

const recommendationUpdateSchema = z.object({
  playTune: tuneContextSchema.nullable().default(null),
  buyTune: tuneContextSchema.nullable().default(null),
}).strict();
const recommendationPresetInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  tune: tuneContextSchema,
}).strict();
const recommendationPresetIdSchema = z.object({ id: z.string().trim().min(1) }).strict();
const recommendationPresetLoadSchema = z.object({ id: z.string().trim().min(1) }).strict();

const tasteSetupPickSchema = z.object({
  gameId: z.string().trim().min(1),
  answer: z.enum(["PLAYED", "LIKED", "SKIPPED"]).nullable().optional(),
}).strict();
const saveTasteSetupSchema = z.object({
  picks: z.array(tasteSetupPickSchema).min(1).max(6),
  experience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable().optional(),
  environment: z.enum(["LINUX", "STEAM_DECK", "WINDOWS"]).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.picks.map((pick) => pick.gameId)).size !== value.picks.length) {
    ctx.addIssue({ code: "custom", path: ["picks"], message: "Duplicate picks are not allowed" });
  }
  if (!value.picks.some((pick) => pick.answer !== undefined && pick.answer !== null)) {
    ctx.addIssue({ code: "custom", path: ["picks"], message: "At least one pick must be answered" });
  }
});

const rotateRecommendationRoleSchema = z.object({
  runId: z.string().trim().min(1),
  role: z.nativeEnum(RecommendationRole),
  itemId: z.string().trim().min(1),
}).strict();

const dismissAndReplaceRecommendationSchema = rotateRecommendationRoleSchema;

const startPlayingFromRecommendationSchema = z.object({
  gameId: z.string().trim().min(1),
  makeMain: z.boolean().optional(),
}).strict();

function candidateId(entry: BatchEntry): string {
  return typeof entry === "string" ? entry : entry.id;
}

function toRotatableCandidate(entry: BatchEntry): RotatableCandidate {
  if (typeof entry !== "string") return entry;
  return { id: entry, score: 0, positive: [], negative: [], caveats: [] };
}

export async function updateRecommendations(input: unknown = {}) {
  try {
    await requireUser();
    const parsed = recommendationUpdateSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const result = await prisma.$transaction(async (tx) => {
      await tx.recommendationTuneState.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          playTune: toNullableJson(parsed.data.playTune),
          buyTune: toNullableJson(parsed.data.buyTune),
        },
        update: {
          playTune: toNullableJson(parsed.data.playTune),
          buyTune: toNullableJson(parsed.data.buyTune),
        },
      });
      return runRecommendationPipeline(tx, parsed.data);
    });
    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to update recommendations"),
    };
  }
}
export interface RotatedRecommendationItem {
  itemId: string;
  role: RecommendationRole;
  gameId: string | null;
  wishlistEntryId: string | null;
  name: string;
  imageUrl: string | null;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

export async function rotateRecommendationRole(input: unknown) {
  try {
    await requireUser();
    const parsed = rotateRecommendationRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { runId, role, itemId } = parsed.data;
    const run = await prisma.recommendationRun.findUnique({
      where: { id: runId },
      select: { id: true, kind: true, context: true },
    });
    if (!run) {
      return { success: false as const, data: null, error: "Run not found" };
    }
    const isPlay = run.kind === "PLAY_NEXT";

    const context = run.context as
      | { roles?: { batches?: Partial<Record<RecommendationRole, BatchEntry[]>> } }
      | null;
    const rawBatch = (context?.roles?.batches ?? {})[role] ?? [];
    if (rawBatch.length === 0) {
      return { success: true as const, data: { rotated: false, item: null }, error: null };
    }
    const batch = rawBatch.map(toRotatableCandidate);
    const batchIds = batch.map((candidate) => candidate.id).filter((id): id is string => Boolean(id));
    if (batchIds.length === 0) {
      return { success: true as const, data: { rotated: false, item: null }, error: null };
    }

    const item = await prisma.recommendationItem.findFirst({
      where: { id: itemId, runId, role },
      select: { id: true, gameId: true, wishlistEntryId: true },
    });
    if (!item) {
      return { success: false as const, data: null, error: "Recommendation item not found" };
    }

    const cooldownCutoff = new Date(Date.now() - EXPOSURE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const recentExcluded = new Set<string>();
    const recentEvents = await prisma.recommendationEvent.findMany({
      where: {
        kind: "EXPOSURE",
        createdAt: { gte: cooldownCutoff },
        ...(isPlay ? { gameId: { in: batchIds } } : { wishlistEntryId: { in: batchIds } }),
      },
      select: { gameId: true, wishlistEntryId: true },
    });
    for (const event of recentEvents) {
      const id = isPlay ? event.gameId : event.wishlistEntryId;
      if (id) recentExcluded.add(id);
    }

    const picked = batch.find((candidate) => !recentExcluded.has(candidate.id)) ?? null;
    if (!picked) {
      return { success: true as const, data: { rotated: false, item: null }, error: null };
    }

    const swapped = await prisma.recommendationItem.updateMany({
      where: { id: itemId, runId, role },
      data: {
        ...(isPlay ? { gameId: picked.id, wishlistEntryId: null } : { gameId: null, wishlistEntryId: picked.id }),
        score: picked.score,
        positive: picked.positive as unknown as Prisma.InputJsonValue,
        negative: picked.negative as unknown as Prisma.InputJsonValue,
        caveats: picked.caveats as unknown as Prisma.InputJsonValue,
      },
    });
    if (swapped.count === 0) {
      return { success: false as const, data: null, error: "Recommendation changed concurrently" };
    }

    const sources = context?.roles?.batches ?? {};
    const nextBatches: Partial<Record<RecommendationRole, BatchEntry[]>> = {};
    for (const key of Object.keys(sources) as RecommendationRole[]) {
      nextBatches[key] = (sources[key] ?? []).filter((entry) => candidateId(entry) !== picked.id);
    }
    const nextContext = {
      ...(context ?? {}),
      roles: { ...(context?.roles ?? {}), batches: nextBatches },
    };
    await prisma.recommendationRun.update({
      where: { id: runId },
      data: { context: nextContext as unknown as Prisma.InputJsonValue },
    });

    try {
      await logRecommendationEvent(prisma, {
        kind: "ROTATION",
        runId,
        ...(isPlay
          ? { gameId: item.gameId ?? undefined }
          : { wishlistEntryId: item.wishlistEntryId ?? undefined }),
        payload: { role },
      });
    } catch {
      // Event telemetry must not make a successful rotation fail.
    }
    try {
      await logRecommendationEvent(prisma, {
        kind: "EXPOSURE",
        runId,
        ...(isPlay ? { gameId: picked.id } : { wishlistEntryId: picked.id }),
        payload: { role },
      });
    } catch {
      // Event telemetry must not make a successful rotation fail.
    }

    const rotatedTarget = isPlay
      ? await prisma.game.findUnique({
          where: { id: picked.id },
          select: {
            name: true,
            metadataSnapshots: {
              where: { provider: "IGDB" },
              orderBy: { fetchedAt: "desc" },
              take: 1,
              select: { payload: true },
            },
          },
        })
      : await prisma.wishlistEntry.findUnique({
          where: { id: picked.id },
          select: {
            name: true,
            metadataSnapshot: { select: { payload: true } },
            baseGame: {
              select: {
                metadataSnapshots: {
                  where: { provider: "IGDB" },
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                  select: { payload: true },
                },
              },
            },
          },
        });
    const imageFromPayload = (payload: unknown) => {
      const parsed = parseIgdbMetadataPayload(payload);
      return parsed?.artworkUrls[0] ?? parsed?.coverUrl ?? null;
    };
    const imageUrl = isPlay
      ? imageFromPayload(
          rotatedTarget && "metadataSnapshots" in rotatedTarget
            ? rotatedTarget.metadataSnapshots[0]?.payload
            : undefined,
        )
      : imageFromPayload(
          rotatedTarget && "metadataSnapshot" in rotatedTarget
            ? rotatedTarget.metadataSnapshot?.payload
            : undefined,
        ) ??
        imageFromPayload(
          rotatedTarget && "baseGame" in rotatedTarget
            ? rotatedTarget.baseGame?.metadataSnapshots[0]?.payload
            : undefined,
        );

    const rotatedItem: RotatedRecommendationItem = {
      itemId,
      role,
      gameId: isPlay ? picked.id : null,
      wishlistEntryId: isPlay ? null : picked.id,
      name: rotatedTarget?.name ?? "Unknown",
      imageUrl,
      score: picked.score,
      positive: picked.positive,
      negative: picked.negative,
      caveats: picked.caveats,
    };
    return { success: true as const, data: { rotated: true, item: rotatedItem }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to rotate recommendation"),
    };
  }
}

export async function dismissAndReplaceRecommendation(input: unknown) {
  try {
    await requireUser();
    const parsed = dismissAndReplaceRecommendationSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };

    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.recommendationRun.findUnique({
        where: { id: parsed.data.runId },
        select: { id: true, kind: true, context: true },
      });
      if (!run) throw new ActionError("Recommendation run not found");

      const item = await tx.recommendationItem.findFirst({
        where: { id: parsed.data.itemId, runId: run.id, role: parsed.data.role },
        select: { id: true, gameId: true, wishlistEntryId: true },
      });
      if (!item) throw new ActionError("Recommendation item is no longer available");

      const isPlay = run.kind === "PLAY_NEXT";
      const targetId = isPlay ? item.gameId : item.wishlistEntryId;
      if (!targetId || (isPlay && item.wishlistEntryId) || (!isPlay && item.gameId)) {
        throw new ActionError("Recommendation item does not match this run");
      }

      const context = run.context as
        | { roles?: { batches?: Partial<Record<RecommendationRole, BatchEntry[]>> } }
        | null;
      const sources = context?.roles?.batches ?? {};
      const batch = (sources[parsed.data.role] ?? []).map(toRotatableCandidate);
      const batchIds = batch.map((candidate) => candidate.id).filter(Boolean);
      const cooldownCutoff = new Date(Date.now() - EXPOSURE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      const recentEvents = batchIds.length === 0 ? [] : await tx.recommendationEvent.findMany({
        where: {
          kind: "EXPOSURE",
          createdAt: { gte: cooldownCutoff },
          ...(isPlay ? { gameId: { in: batchIds } } : { wishlistEntryId: { in: batchIds } }),
        },
        select: { gameId: true, wishlistEntryId: true },
      });
      const recentIds = new Set(recentEvents.map((event) => isPlay ? event.gameId : event.wishlistEntryId));
      const replacementCandidate = batch.find((candidate) => !recentIds.has(candidate.id)) ?? null;

      await tx.recommendationFeedback.create({
        data: isPlay
          ? { gameId: targetId, wishlistEntryId: null, kind: run.kind }
          : { gameId: null, wishlistEntryId: targetId, kind: run.kind },
      });

      if (!replacementCandidate) {
        const deleted = await tx.recommendationItem.deleteMany({
          where: { id: item.id, runId: run.id, role: parsed.data.role },
        });
        if (deleted.count !== 1) throw new ActionError("Recommendation changed concurrently");
        return { dismissedItemId: item.id, replacement: null, kind: run.kind, targetId };
      }

      const updated = await tx.recommendationItem.updateMany({
        where: { id: item.id, runId: run.id, role: parsed.data.role },
        data: {
          ...(isPlay
            ? { gameId: replacementCandidate.id, wishlistEntryId: null }
            : { gameId: null, wishlistEntryId: replacementCandidate.id }),
          score: replacementCandidate.score,
          positive: replacementCandidate.positive as unknown as Prisma.InputJsonValue,
          negative: replacementCandidate.negative as unknown as Prisma.InputJsonValue,
          caveats: replacementCandidate.caveats as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) throw new ActionError("Recommendation changed concurrently");

      const nextBatches = Object.fromEntries(
        Object.entries(sources).map(([role, entries]) => [
          role,
          (entries ?? []).filter((entry) => candidateId(entry) !== replacementCandidate.id),
        ]),
      );
      await tx.recommendationRun.update({
        where: { id: run.id },
        data: {
          context: {
            ...(context ?? {}),
            roles: { ...(context?.roles ?? {}), batches: nextBatches },
          } as Prisma.InputJsonValue,
        },
      });

      return {
        dismissedItemId: item.id,
        replacement: {
          itemId: item.id,
          role: parsed.data.role,
          gameId: isPlay ? replacementCandidate.id : null,
          wishlistEntryId: isPlay ? null : replacementCandidate.id,
          name: "",
          imageUrl: null,
          score: replacementCandidate.score,
          positive: replacementCandidate.positive,
          negative: replacementCandidate.negative,
          caveats: replacementCandidate.caveats,
        } as RotatedRecommendationItem,
        kind: run.kind,
        targetId,
      };
    });

    if (result.replacement) {
      const imageFromPayload = (payload: unknown) => {
        const metadata = parseIgdbMetadataPayload(payload);
        return metadata?.artworkUrls[0] ?? metadata?.coverUrl ?? null;
      };
      if (result.kind === "PLAY_NEXT") {
        const replacementTarget = await prisma.game.findUnique({
          where: { id: result.replacement.gameId! },
          select: { name: true, metadataSnapshots: { where: { provider: "IGDB" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { payload: true } } },
        });
        result.replacement.name = replacementTarget?.name ?? "Unknown";
        result.replacement.imageUrl = imageFromPayload(replacementTarget?.metadataSnapshots[0]?.payload);
      } else {
        const replacementTarget = await prisma.wishlistEntry.findUnique({
          where: { id: result.replacement.wishlistEntryId! },
          select: { name: true, metadataSnapshot: { select: { payload: true } }, baseGame: { select: { metadataSnapshots: { where: { provider: "IGDB" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { payload: true } } } } },
        });
        result.replacement.name = replacementTarget?.name ?? "Unknown";
        result.replacement.imageUrl = imageFromPayload(replacementTarget?.metadataSnapshot?.payload)
          ?? imageFromPayload(replacementTarget?.baseGame?.metadataSnapshots[0]?.payload);
      }
    }

    try {
      await logRecommendationEvent(prisma, {
        kind: "DISMISSAL",
        runId: parsed.data.runId,
        ...(result.kind === "PLAY_NEXT" ? { gameId: result.targetId } : { wishlistEntryId: result.targetId }),
        payload: { role: parsed.data.role },
      });
      if (result.replacement) {
        await logRecommendationEvent(prisma, {
          kind: "EXPOSURE",
          runId: parsed.data.runId,
          ...(result.kind === "PLAY_NEXT" ? { gameId: result.replacement.gameId! } : { wishlistEntryId: result.replacement.wishlistEntryId! }),
          payload: { role: parsed.data.role },
        });
      }
    } catch {
      // Telemetry never changes the authoritative dismissal-and-replacement result.
    }

    return {
      success: true as const,
      data: { dismissedItemId: result.dismissedItemId, replacement: result.replacement },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to replace recommendation"),
    };
  }
}

export async function startPlayingFromRecommendation(input: unknown) {
  try {
    await requireUser();
    const parsed = startPlayingFromRecommendationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { gameId, makeMain } = parsed.data;
    const entry = await prisma.libraryEntry.findFirst({
      where: { gameId },
      select: { playState: true },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Library entry not found" };
    }
    if (entry.playState === "IN_PROGRESS") {
      return { success: true as const, data: { started: true, needsMainDecision: false, inProgressGame: null }, error: null };
    }

    const current = await prisma.libraryEntry.findFirst({
      where: { playState: "IN_PROGRESS", gameId: { not: gameId } },
      select: { game: { select: { name: true } } },
    });
    if (current && makeMain === undefined) {
      return {
        success: true as const,
        data: { started: false, needsMainDecision: true, inProgressGame: current.game?.name ?? null },
        error: null,
      };
    }

    const mainFlag = current ? (makeMain === true) : true;
    await updatePlayState(gameId, {
      playState: "IN_PROGRESS",
      ...(mainFlag ? { isMainGame: true } : {}),
    });

    return {
      success: true as const,
      data: { started: true, needsMainDecision: false, inProgressGame: null },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to start playing from recommendation"),
    };
  }
}

export async function dismissRecommendation(input: unknown) {
  try {
    await requireUser();
    const parsed = dismissRecommendationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const row = await prisma.recommendationFeedback.create({
      data: {
        gameId: parsed.data.gameId ?? null,
        wishlistEntryId: parsed.data.wishlistEntryId ?? null,
        kind: parsed.data.kind,
      },
      select: { id: true },
    });
    try {
      await logRecommendationEvent(prisma, {
        kind: "DISMISSAL",
        gameId: parsed.data.gameId,
        wishlistEntryId: parsed.data.wishlistEntryId,
        runId: parsed.data.runId,
        reason: parsed.data.reason || undefined,
      });
    } catch {
      // Event telemetry must not make a successful dismissal fail.
    }
    return { success: true as const, data: { id: row.id }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to dismiss recommendation"),
    };
  }
}

export async function recordRunExposure(input: unknown) {
  try {
    await requireUser();
    const parsed = recordRunExposureSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }
    if (parsed.data.items.length === 0) {
      return { success: true as const, data: { count: 0 }, error: null };
    }

    const result = await prisma.recommendationEvent.createMany({
      data: parsed.data.items.map((item) => ({
        runId: parsed.data.runId,
        kind: "EXPOSURE" as const,
        gameId: item.gameId ?? null,
        wishlistEntryId: item.wishlistEntryId ?? null,
        ...(item.role ? { payload: { role: item.role } } : {}),
      })),
    });
    return { success: true as const, data: { count: result.count }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to record exposure"),
    };
  }
}

export async function setRecommendationPreference(input: unknown) {
  try {
    await requireUser();
    const parsed = recommendationPreferenceSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const row = await prisma.recommendationPreference.upsert({
      where: { dimension_value: { dimension: parsed.data.dimension, value: parsed.data.value } },
      create: parsed.data,
      update: { attitude: parsed.data.attitude },
    });
    return { success: true as const, data: row, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to set preference") };
  }
}

export async function saveRecommendationPreset(input: unknown) {
  try {
    await requireUser();
    const parsed = recommendationPresetInputSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const preset = await prisma.recommendationPreset.upsert({
      where: { name: parsed.data.name },
      create: { name: parsed.data.name, tune: parsed.data.tune as unknown as Prisma.InputJsonValue },
      update: { tune: parsed.data.tune as unknown as Prisma.InputJsonValue },
    });
    return { success: true as const, data: preset, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to save preset") };
  }
}

export async function listRecommendationPresets() {
  try {
    await requireUser();
    const presets = await loadRecommendationPresets();
    return { success: true as const, data: presets, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to list presets") };
  }
}

export async function deleteRecommendationPreset(input: unknown) {
  try {
    await requireUser();
    const parsed = recommendationPresetIdSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    await prisma.recommendationPreset.deleteMany({ where: { id: parsed.data.id } });
    return { success: true as const, data: { id: parsed.data.id }, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to delete preset") };
  }
}

export async function loadRecommendationPreset(input: unknown) {
  try {
    await requireUser();
    const parsed = recommendationPresetLoadSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const preset = await prisma.recommendationPreset.findUnique({ where: { id: parsed.data.id } });
    if (!preset) return { success: false as const, data: null, error: "Preset not found" };
    const tune = tuneContextSchema.safeParse(preset.tune);
    if (!tune.success) return { success: false as const, data: null, error: "Preset contains an invalid tune" };
    return { success: true as const, data: { tune: tune.data }, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to load preset") };
  }
}

export async function listKnownGenreTagValues() {
  try {
    await requireUser();
    const data = await loadKnownGenreTagValues();
    return { success: true as const, data, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to list known values") };
  }
}

export async function saveTasteSetup(input: unknown) {
  try {
    await requireUser();
    const parsed = saveTasteSetupSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };

    const data = await prisma.$transaction(async (tx) => {
      const rows = await tx.game.findMany({
        where: { id: { in: parsed.data.picks.map((pick) => pick.gameId) } },
        select: {
          id: true,
          name: true,
          type: true,
          libraryEntry: {
            select: { playState: true, interest: true, hidden: true, isMainGame: true },
          },
        },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));

      for (const pick of parsed.data.picks) {
        const row = byId.get(pick.gameId);
        if (!row || row.type !== "BASE_GAME" || !row.libraryEntry || row.libraryEntry.hidden || row.libraryEntry.isMainGame) {
          throw new ActionError("Taste setup pick is not an eligible owned base game");
        }
      }

      const picks = [];
      for (const pick of parsed.data.picks) {
        const row = byId.get(pick.gameId)!;
        if (!pick.answer) {
          picks.push({ gameId: row.id, name: row.name, answer: null, seeded: false });
          continue;
        }

        const updateData: Prisma.LibraryEntryUpdateInput = {};
        if (pick.answer === "PLAYED") {
          updateData.completedBefore = true;
        }
        if (pick.answer === "LIKED" && row.libraryEntry!.interest === null) {
          updateData.interest = 5;
        }
        if (pick.answer !== "SKIPPED" && parsed.data.experience) {
          updateData.gameExperience = parsed.data.experience;
        }
        if (pick.answer !== "SKIPPED" && parsed.data.environment) {
          updateData.preferredEnvironment = parsed.data.environment;
        }
        if (Object.keys(updateData).length > 0) {
          await tx.libraryEntry.update({ where: { gameId: row.id }, data: updateData });
        }
        await logRecommendationEvent(tx, {
          kind: "TASTE_SETUP_ANSWER",
          gameId: row.id,
          payload: { answer: pick.answer },
        });
        picks.push({ gameId: row.id, name: row.name, answer: pick.answer, seeded: Object.keys(updateData).length > 0 });
      }

      const rebuiltAt = new Date();
      const profile = await rebuildRecommendationProfile(tx, rebuiltAt);
      return { picks, profile, rebuiltAt };
    });

    return { success: true as const, data, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to save taste setup") };
  }
}

export async function removeRecommendationPreference(input: unknown) {
  try {
    await requireUser();
    const parsed = recommendationPreferenceIdSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    await prisma.recommendationPreference.deleteMany({ where: { id: parsed.data.id } });
    return { success: true as const, data: { id: parsed.data.id }, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to remove preference") };
  }
}

export async function rebuildRecommendationProfileAction() {
  try {
    await requireUser();
    const rebuiltAt = new Date();
    const payload = await rebuildRecommendationProfile(prisma as unknown as Prisma.TransactionClient, rebuiltAt);
    return { success: true as const, data: { payload, rebuiltAt }, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to rebuild recommendation profile") };
  }
}

export async function restartRecommendations() {
  try {
    await requireUser();
    const counts = await prisma.$transaction(async (tx) => {
      const events = await tx.recommendationEvent.deleteMany({});
      const feedback = await tx.recommendationFeedback.deleteMany({});
      const runs = await tx.recommendationRun.deleteMany({});
      const profile = await tx.recommendationProfile.deleteMany({});
      const preferences = await tx.recommendationPreference.deleteMany({});
      const presets = await tx.recommendationPreset.deleteMany({});
      const tuneState = await tx.recommendationTuneState.deleteMany({});
      return {
        recommendationEvent: events.count,
        recommendationFeedback: feedback.count,
        recommendationRun: runs.count,
        recommendationProfile: profile.count,
        recommendationPreference: preferences.count,
        recommendationPreset: presets.count,
        recommendationTuneState: tuneState.count,
      };
    });
    return { success: true as const, data: counts, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to restart recommendations"),
    };
  }
}
