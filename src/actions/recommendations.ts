"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { Prisma, RecommendationRole } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
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

const KNOWN_VALUES_CACHE_TTL_MS = 10 * 60 * 1000;
type KnownGenreTagValues = { genres: string[]; tags: string[] };
type BatchEntry = string | RotatableCandidate;
let knownValuesCache: { data: KnownGenreTagValues; expiresAt: number } | null = null;

export async function resetKnownGenreTagValuesCache() {
  await requireUser();
  knownValuesCache = null;
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

const tuneEngineSchema = z.enum(["PLAY_NEXT", "BUY"]);
const tuneStateInputSchema = z.object({
  engine: tuneEngineSchema,
  tune: tuneContextSchema,
}).strict();
const tuneEngineInputSchema = z.object({ engine: tuneEngineSchema }).strict();
const recommendationPresetInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  tune: tuneContextSchema,
}).strict();
const recommendationPresetIdSchema = z.object({ id: z.string().trim().min(1) }).strict();
const recommendationPresetLoadSchema = z.object({ id: z.string().trim().min(1), engine: tuneEngineSchema }).strict();

const tasteSetupPickSchema = z.object({
  gameId: z.string().trim().min(1),
  answer: z.enum(["PLAYED", "LIKED", "SKIPPED"]).nullable().optional(),
}).strict();
const saveTasteSetupSchema = z.object({
  picks: z.array(tasteSetupPickSchema).min(1).max(6),
  experience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable().optional(),
  environment: z.enum(["BAZZITE", "STEAM_DECK", "WINDOWS"]).nullable().optional(),
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

export async function updateRecommendations() {
  try {
    await requireUser();
    const result = await prisma.$transaction((tx) => runRecommendationPipeline(tx));
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

    const name = isPlay
      ? (await prisma.game.findUnique({ where: { id: picked.id }, select: { name: true } }))?.name
      : (await prisma.wishlistEntry.findUnique({ where: { id: picked.id }, select: { name: true } }))?.name;

    const rotatedItem: RotatedRecommendationItem = {
      itemId,
      role,
      gameId: isPlay ? picked.id : null,
      wishlistEntryId: isPlay ? null : picked.id,
      name: name ?? "Unknown",
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

function tuneStateField(engine: "PLAY_NEXT" | "BUY"): "playTune" | "buyTune" {
  return engine === "PLAY_NEXT" ? "playTune" : "buyTune";
}

export async function saveTuneState(input: unknown) {
  try {
    await requireUser();
    const parsed = tuneStateInputSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const field = tuneStateField(parsed.data.engine);
    const tune = parsed.data.tune as unknown as Prisma.InputJsonValue;
    const state = await prisma.recommendationTuneState.upsert({
      where: { id: 1 },
      create: { id: 1, [field]: tune },
      update: { [field]: tune },
    });
    return { success: true as const, data: state, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to save tune") };
  }
}

export async function clearTuneState(input: unknown) {
  try {
    await requireUser();
    const parsed = tuneEngineInputSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const field = tuneStateField(parsed.data.engine);
    const state = await prisma.recommendationTuneState.upsert({
      where: { id: 1 },
      create: { id: 1, [field]: null },
      update: { [field]: null },
    });
    return { success: true as const, data: state, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to clear tune") };
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
    const presets = await prisma.recommendationPreset.findMany({ orderBy: { name: "asc" } });
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
    const field = tuneStateField(parsed.data.engine);
    const state = await prisma.recommendationTuneState.upsert({
      where: { id: 1 },
      create: { id: 1, [field]: tune.data as unknown as Prisma.InputJsonValue },
      update: { [field]: tune.data as unknown as Prisma.InputJsonValue },
    });
    return { success: true as const, data: state, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to load preset") };
  }
}

export async function listKnownGenreTagValues() {
  try {
    await requireUser();
    if (knownValuesCache && knownValuesCache.expiresAt > Date.now()) {
      return { success: true as const, data: knownValuesCache.data, error: null };
    }

    const [games, wishlistEntries] = await Promise.all([
      prisma.game.findMany({
        select: { metadataSnapshots: { where: { provider: "RAWG" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { payload: true } } },
      }),
      prisma.wishlistEntry.findMany({ select: { metadataSnapshot: { select: { payload: true } } } }),
    ]);
    const genres = new Set<string>();
    const tags = new Set<string>();
    for (const payload of [...games.flatMap((game) => game.metadataSnapshots.map((snapshot) => snapshot.payload)), ...wishlistEntries.map((entry) => entry.metadataSnapshot?.payload)]) {
      const parsed = parseRawgMetadataPayload(payload);
      for (const genre of parsed?.genres ?? []) if (genre) genres.add(genre);
      for (const tag of parsed?.tags ?? []) if (tag) tags.add(tag);
    }
    const data = { genres: [...genres].sort(), tags: [...tags].sort() };
    knownValuesCache = { data, expiresAt: Date.now() + KNOWN_VALUES_CACHE_TTL_MS };
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
        if (pick.answer === "PLAYED" && row.libraryEntry!.playState === "NOT_STARTED") {
          updateData.playState = "PLAYED_BEFORE";
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
