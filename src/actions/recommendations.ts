"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { prisma } from "@/lib/prisma";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { buildCompatContext } from "@/lib/recommendations/compat-context";
import {
  isEligibleForBuy,
  rankBuyCandidates,
  type BuyCandidate,
  type BuyOffer,
} from "@/lib/recommendations/buy";
import {
  isEligibleForPlayNext,
  rankPlayNextCandidates,
} from "@/lib/recommendations/play-next";
import type {
  CompatEvidenceInput,
  ExplanationCaveat,
  ExplanationFactor,
  PlayNextCandidate,
} from "@/lib/recommendations/types";
import { RUN_RETENTION_DAYS } from "@/lib/recommendations/types";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import { pruneRecommendationEvents } from "@/lib/recommendations/events";
import { rebuildRecommendationProfile } from "@/lib/recommendations/profile";

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

async function loadCandidates(client: Prisma.TransactionClient) {
  return client.game.findMany({
    where: { type: "BASE_GAME", libraryEntry: { isNot: null } },
    select: {
      id: true,
      name: true,
      type: true,
      libraryEntry: {
        select: {
          playState: true,
          priority: true,
          interest: true,
          playSoon: true,
          replayCandidate: true,
          hidden: true,
          isMainGame: true,
        },
      },
      externalIds: { select: { externalId: true } },
      availability: { select: { source: true } },
      compatSnapshots: {
        select: { provider: true, result: true, fetchedAt: true },
      },
    },
  });
}

function compatEvidenceFor(row: {
  externalIds: { externalId: string }[];
  availability: { source: "STEAM" | "OTHER_PLATFORM" | "ROM" }[];
  compatSnapshots: { provider: string; result: unknown; fetchedAt: Date }[];
}): CompatEvidenceInput {
  const steamAppId = row.externalIds[0]?.externalId ?? null;
  const romOnly =
    row.availability.some((a) => a.source === "ROM") &&
    !row.availability.some((a) => a.source === "STEAM");
  const protonDbSnapshot = row.compatSnapshots.find(
    (snapshot) => snapshot.provider === "PROTONDB",
  );
  const awaySnapshot = row.compatSnapshots.find(
    (snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET",
  );
  const protonDb = steamAppId && protonDbSnapshot
    ? parseProtonDbSummary(steamAppId, protonDbSnapshot.result)
    : null;
  const antiCheat = parseAntiCheatEvidence(awaySnapshot?.result);

  return {
    hasSteamIdentity: Boolean(steamAppId),
    romOnly,
    overrideStatus: null,
    protonDbStatus: protonDb?.status ?? null,
    protonDbFetchedAt: protonDbSnapshot?.fetchedAt ?? null,
    awayStatus: antiCheat?.status ?? null,
  };
}

async function loadBuyCandidates(client: Prisma.TransactionClient) {
  const entries = await client.wishlistEntry.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      interest: true,
      targetPriceMxn: true,
      updatedAt: true,
      baseGameId: true,
      offers: {
        select: {
          price: true,
          currency: true,
          discount: true,
          historicalLow: true,
          sourceHistoricalLow: true,
          expiresAt: true,
          fetchedAt: true,
          itadFlag: true,
        },
      },
    },
  });

  if (entries.length === 0) {
    return [];
  }

  const baseGameIds = [
    ...new Set(
      entries
        .map((entry) => entry.baseGameId)
        .filter((id): id is string => id != null),
    ),
  ];
  const baseGames = await client.game.findMany({
    where: { id: { in: baseGameIds } },
    select: {
      id: true,
      availability: { select: { source: true } },
      libraryEntry: {
        select: {
          rating: true,
          playState: true,
          replayCandidate: true,
        },
      },
    },
  });
  const baseById = new Map(baseGames.map((base) => [base.id, base]));

  return entries.map((entry): BuyCandidate => ({
    id: entry.id,
    name: entry.name,
    updatedAt: entry.updatedAt,
    type: entry.type,
    interest: entry.interest,
    targetPriceMxn: entry.targetPriceMxn,
    offers: entry.offers as BuyOffer[],
    baseGame:
      entry.type === "DLC" && entry.baseGameId && baseById.has(entry.baseGameId)
        ? (baseById.get(entry.baseGameId) ?? null)
        : null,
  }));
}

export async function updateRecommendations() {
  try {
    await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const pruneCutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const pruned = await tx.recommendationRun.deleteMany({
        where: { createdAt: { lt: pruneCutoff } },
      });
      const prunedEvents = await pruneRecommendationEvents(tx, now);
      const profile = await rebuildRecommendationProfile(tx, now);

      const rows = await loadCandidates(tx);
      const candidates: PlayNextCandidate[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        libraryEntry: row.libraryEntry,
      }));
      const eligible = candidates.filter(isEligibleForPlayNext);
      const ranked = rankPlayNextCandidates(candidates);
      const evidenceById = new Map(rows.map((row) => [row.id, compatEvidenceFor(row)]));

      const buyCandidates = await loadBuyCandidates(tx);
      const buyEligibleList = buyCandidates.filter(isEligibleForBuy);
      const buyRanked = rankBuyCandidates(buyCandidates, now);

      const context = {
        eligible: { playNext: eligible.length, buy: buyEligibleList.length },
        prunedRuns: pruned.count,
        prunedEvents,
        profile: { rebuiltAt: now.toISOString(), eventsConsidered: profile.evidence.eventsConsidered },
      };
      const contextJson = context as unknown as Prisma.InputJsonValue;

      const playNextRun = await tx.recommendationRun.create({
        data: {
          kind: "PLAY_NEXT",
          context: contextJson,
          items: {
            create: ranked.map((item) => {
              const evidence = evidenceById.get(item.id)!;
              const verdict = buildCompatContext(evidence, now);
              const positive: ExplanationFactor[] = [
                ...item.positive,
                ...verdict.positives,
              ];
              const negative: ExplanationFactor[] = [...item.negative];
              const caveats: ExplanationCaveat[] = [...verdict.caveats];
              return {
                gameId: item.id,
                rank: item.rank,
                score: item.score,
                positive: positive as unknown as Prisma.InputJsonValue,
                negative: negative as unknown as Prisma.InputJsonValue,
                caveats: caveats as unknown as Prisma.InputJsonValue,
              };
            }),
          },
        },
        select: { id: true },
      });

      const buyRun = await tx.recommendationRun.create({
        data: {
          kind: "BUY",
          context: contextJson,
          items: {
            create: buyRanked.map((item) => ({
              wishlistEntryId: item.id,
              rank: item.rank,
              score: item.score,
              positive: item.positive as unknown as Prisma.InputJsonValue,
              negative: item.negative as unknown as Prisma.InputJsonValue,
              caveats: item.caveats as unknown as Prisma.InputJsonValue,
            })),
          },
        },
        select: { id: true },
      });

      return {
        playNextRunId: playNextRun.id,
        buyRunId: buyRun.id,
        playNextItems: ranked.length,
        playNextEligible: eligible.length,
        buyItems: buyRanked.length,
        buyEligible: buyEligibleList.length,
        prunedRuns: pruned.count,
        prunedEvents,
        profile: { rebuiltAt: now.toISOString(), eventsConsidered: profile.evidence.eventsConsidered },
      };
    });

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update recommendations",
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
      error: err instanceof Error ? err.message : "Failed to dismiss recommendation",
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
      })),
    });
    return { success: true as const, data: { count: result.count }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to record exposure",
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
    return { success: false as const, data: null, error: err instanceof Error ? err.message : "Failed to set preference" };
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
    return { success: false as const, data: null, error: err instanceof Error ? err.message : "Failed to remove preference" };
  }
}

export async function rebuildRecommendationProfileAction() {
  try {
    await requireUser();
    const rebuiltAt = new Date();
    const payload = await rebuildRecommendationProfile(prisma as unknown as Prisma.TransactionClient, rebuiltAt);
    return { success: true as const, data: { payload, rebuiltAt }, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: err instanceof Error ? err.message : "Failed to rebuild recommendation profile" };
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
      return {
        recommendationEvent: events.count,
        recommendationFeedback: feedback.count,
        recommendationRun: runs.count,
        recommendationProfile: profile.count,
        recommendationPreference: preferences.count,
      };
    });
    return { success: true as const, data: counts, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to restart recommendations",
    };
  }
}
