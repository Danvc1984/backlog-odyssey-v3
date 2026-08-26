"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { prisma } from "@/lib/prisma";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { buildCompatContext } from "@/lib/recommendations/compat-context";
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

const dismissRecommendationSchema = z
  .object({
    gameId: z.string().trim().min(1).optional(),
    wishlistEntryId: z.string().trim().min(1).optional(),
    kind: z.enum(["PLAY_NEXT", "BUY"]),
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

export async function updateRecommendations() {
  try {
    await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const pruneCutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const pruned = await tx.recommendationRun.deleteMany({
        where: { createdAt: { lt: pruneCutoff } },
      });

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

      const context = {
        eligible: { playNext: eligible.length, buy: 0 },
        prunedRuns: pruned.count,
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
        data: { kind: "BUY", context: contextJson },
        select: { id: true },
      });

      return {
        playNextRunId: playNextRun.id,
        buyRunId: buyRun.id,
        playNextItems: ranked.length,
        playNextEligible: eligible.length,
        prunedRuns: pruned.count,
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
    return { success: true as const, data: { id: row.id }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to dismiss recommendation",
    };
  }
}
