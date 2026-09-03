import "server-only";

import { RecommendationRole, type CompatibilityStatus, type Environment, type GameExperience, type PlayState, type Prisma } from "@/generated/prisma/client";
import { pruneRecommendationEvents } from "@/lib/recommendations/events";
import { rebuildRecommendationProfile } from "@/lib/recommendations/profile";
import { RUN_RETENTION_DAYS, tuneContextSchema, type TuneContext } from "@/lib/recommendations/types";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { resolveCandidateDimensionValues } from "@/lib/recommendations/profile";
import { rerankPlayCandidates, type RerankPlayInput, type TastePreference } from "@/lib/recommendations/rerank";
import { rerankBuyCandidates, type RerankBuyInput } from "@/lib/recommendations/rerank";
import { assignPlayRoles } from "@/lib/recommendations/roles";
import { assignBuyRoles } from "@/lib/recommendations/roles";
import { getBuyDealInputs, type BuyCandidate, type RankedBuyItem } from "@/lib/recommendations/buy";
import { countTuneMatches, type TuneCandidateInput } from "@/lib/recommendations/tune";
import type { CandidateSource } from "@/lib/recommendations/tune";
import type { CompatEvidenceInput, ExplanationCaveat, ExplanationFactor, PlayNextCandidate } from "@/lib/recommendations/types";
import { buildCompatContext } from "@/lib/recommendations/compat-context";
import { isEligibleForBuy, rankAllBuyCandidates } from "@/lib/recommendations/buy";
import { isEligibleForPlayNext, rankAllPlayNextCandidates } from "@/lib/recommendations/play-next";
import { calibratedInterest } from "@/lib/recommendations/calibration";
import { filterStaleExposures } from "@/lib/recommendations/exposure";
import { applySourceTune } from "@/lib/recommendations/tune";
import {
  appendCalibration,
  applyTune,
  calibrationKey,
  compatEvidenceFor,
  loadBuyCandidates,
  loadCandidates,
  loadDismissalCounts,
  loadLatestExposures,
  tuneInput,
} from "@/lib/recommendations/pipeline-helpers";

interface PlayRow {
  id: string;
  name: string;
  metadataSnapshots: Array<{ payload: unknown }>;
  libraryEntry: {
    playState: PlayState;
    replayCandidate: boolean;
    gameExperience: GameExperience | null;
    preferredEnvironment: Environment | null;
  } | null;
  availability: Array<{
    source: "STEAM" | "OTHER_PLATFORM" | "ROM";
    alternativeSourceId: string | null;
    steamLastPlayed: Date | null;
  }>;
  envCompat: Array<{ environment: Environment; status: CompatibilityStatus }>;
  externalIds: Array<{ externalId: string }>;
  compatSnapshots: Array<{ provider: string; result: unknown; fetchedAt: Date }>;
}

interface SourceTunedPlayItem {
  id: string;
  name: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  sources: CandidateSource[];
}

export function buildPlayPipeline(
  pool: SourceTunedPlayItem[],
  rows: ReadonlyMap<string, PlayRow>,
  profile: Parameters<typeof rerankPlayCandidates>[1],
  preferences: TastePreference[],
  now: Date,
  secondChanceIds: string[],
) {
  const rerankInputs: RerankPlayInput[] = pool.map((item) => {
    const row = rows.get(item.id);
    if (!row) throw new Error(`Missing recommendation row for ${item.id}`);
    const payload = row.metadataSnapshots[0]?.payload;
    const parsedPayload = parseRawgMetadataPayload(payload);
    const dimensionValues = resolveCandidateDimensionValues(payload, {
      gameExperience: row.libraryEntry?.gameExperience ?? null,
      preferredEnvironment: row.libraryEntry?.preferredEnvironment ?? null,
    });
    const steamRow = row.availability.find(
      (availability) => availability.source === "STEAM" && availability.steamLastPlayed !== null,
    );
    const envRow = row.libraryEntry?.preferredEnvironment
      ? row.envCompat.find((entry) => entry.environment === row.libraryEntry?.preferredEnvironment)
      : undefined;
    return {
      id: item.id,
      name: item.name,
      baselineScore: item.score,
      positive: item.positive,
      negative: item.negative,
      caveats: item.caveats,
      dimensionValues,
      steam: {
        playState: row.libraryEntry?.playState ?? null,
        replayCandidate: row.libraryEntry?.replayCandidate ?? false,
        steamLastPlayed: steamRow?.steamLastPlayed ?? null,
      },
      envStatus: envRow?.status ?? null,
      quality: {
        metacriticScore: parsedPayload?.metacriticScore ?? null,
        rating: parsedPayload?.rating ?? null,
      },
    };
  });
  const playRerank = rerankPlayCandidates(rerankInputs, profile, preferences, now);
  const playRoles = assignPlayRoles(
    playRerank.pool.map((item) => ({
      id: item.id,
      tastePoints: item.tastePoints,
      envStatus: item.envStatus,
      genres: item.genres,
    })),
    playRerank.context.mode,
    secondChanceIds,
  );
  const playPoolById = new Map<string, (typeof playRerank.pool)[number]>();
  for (const item of playRerank.pool) {
    if (!playPoolById.has(item.id)) playPoolById.set(item.id, item);
  }
  const playItems = playRoles.assigned.flatMap((assignment) => {
    const item = playPoolById.get(assignment.id);
    return item ? [{ ...item, caveats: [...item.caveats, ...assignment.caveats], role: assignment.role }] : [];
  });
  return { playRerank, playRoles, playPoolById, playItems };
}

interface BuyView {
  payload: unknown;
  gameExperience: string | null;
}

export function buildBuyPipeline(
  tunedBuyPool: RankedBuyItem[],
  buyCandidateById: ReadonlyMap<string, BuyCandidate>,
  wishViews: ReadonlyMap<string, BuyView>,
  profile: Parameters<typeof rerankBuyCandidates>[1],
  preferences: TastePreference[],
  now: Date,
) {
  const buyRerankInputs: RerankBuyInput[] = tunedBuyPool.map((item) => {
    const view = wishViews.get(item.id);
    const payload = view?.payload ?? null;
    const parsedPayload = parseRawgMetadataPayload(payload);
    return {
      id: item.id,
      baselineScore: item.score,
      positive: item.positive,
      negative: item.negative,
      caveats: item.caveats,
      dimensionValues: resolveCandidateDimensionValues(payload, {
        gameExperience: view?.gameExperience ?? null,
        preferredEnvironment: null,
      }),
      quality: {
        metacriticScore: parsedPayload?.metacriticScore ?? null,
        rating: parsedPayload?.rating ?? null,
      },
      tiebreak: {
        historicalLowGap: item.historicalLowGap,
        updatedAt: buyCandidateById.get(item.id)?.updatedAt ?? now,
        id: item.id,
      },
      ...getBuyDealInputs(buyCandidateById.get(item.id)!, now),
    };
  });
  const buyRerank = rerankBuyCandidates(buyRerankInputs, profile, preferences);
  const buyRoles = assignBuyRoles(
    buyRerank.pool.map((item) => ({
      id: item.id,
      interest: buyCandidateById.get(item.id)?.interest ?? null,
      tastePoints: item.tastePoints,
      isFresh: item.isFresh,
      freshDiscount: item.freshDiscount,
      isKeyshop: item.isKeyshop,
    })),
  );
  const buyPoolById = new Map(buyRerank.pool.map((item) => [item.id, item]));
  const buyItems = buyRoles.assigned.flatMap((assignment) => {
    const item = buyPoolById.get(assignment.id);
    return item ? [{ ...item, caveats: [...item.caveats, ...assignment.caveats], role: assignment.role }] : [];
  });
  return { buyRerank, buyRoles, buyPoolById, buyItems };
}

interface PersistPlayItem {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  role: RecommendationRole;
}

interface PersistBuyItem {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  role: RecommendationRole;
}

interface SnapshotSource {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

function snapshotBatches(
  batches: Record<RecommendationRole, string[]>,
  byId: ReadonlyMap<string, SnapshotSource>,
) {
  return Object.fromEntries(
    Object.entries(batches).map(([role, ids]) => [
      role,
      ids.map((id) => byId.get(id)).filter((source): source is SnapshotSource => source !== undefined),
    ]),
  );
}

export function buildRecommendationContexts({
  baseContext,
  playStaleExcluded,
  buyStaleExcluded,
  playRerankContext,
  buyRerankContext,
  playRoles,
  buyRoles,
  playPoolById,
  buyPoolById,
  playTune,
  buyTune,
  tunedBuyPool,
  buyTuneInputs,
}: {
  baseContext: object;
  playStaleExcluded: number;
  buyStaleExcluded: number;
  playRerankContext: object;
  buyRerankContext: object;
  playRoles: { batches: Record<RecommendationRole, string[]> };
  buyRoles: { batches: Record<RecommendationRole, string[]>; saturation: unknown };
  playPoolById: ReadonlyMap<string, SnapshotSource>;
  buyPoolById: ReadonlyMap<string, SnapshotSource>;
  playTune: TuneContext | null;
  buyTune: TuneContext | null;
  tunedBuyPool: Array<{ id: string }>;
  buyTuneInputs: ReadonlyMap<string, TuneCandidateInput>;
}) {
  const playContext = {
    ...baseContext,
    staleExcluded: playStaleExcluded,
    rerank: playRerankContext,
    roles: { batches: snapshotBatches(playRoles.batches, playPoolById) },
  } as unknown as Prisma.InputJsonValue;
  const buyContext = {
    ...baseContext,
    staleExcluded: buyStaleExcluded,
    tune: {
      play: playTune,
      buy: buyTune,
      thinPool: Boolean(buyTune && countTuneMatches(buyTune, tunedBuyPool.map((item) => buyTuneInputs.get(item.id) ?? {}), 3).thinPool),
    },
    rerank: buyRerankContext,
    roles: { batches: snapshotBatches(buyRoles.batches, buyPoolById), saturation: buyRoles.saturation },
  } as unknown as Prisma.InputJsonValue;
  return { playContext, buyContext };
}

export async function persistRecommendationRuns(
  client: Prisma.TransactionClient,
  playContext: Prisma.InputJsonValue,
  buyContext: Prisma.InputJsonValue,
  playItems: PersistPlayItem[],
  buyItems: PersistBuyItem[],
  evidenceById: ReadonlyMap<string, CompatEvidenceInput>,
  now: Date,
) {
  const playNextRun = await client.recommendationRun.create({
    data: {
      kind: "PLAY_NEXT",
      context: playContext,
      items: {
        create: playItems.map((item, index) => {
          const evidence = evidenceById.get(item.id);
          if (!evidence) throw new Error(`Missing compatibility evidence for ${item.id}`);
          const verdict = buildCompatContext(evidence, now);
          return {
            game: { connect: { id: item.id } },
            rank: index + 1,
            score: item.score,
            positive: [...item.positive, ...verdict.positives] as unknown as Prisma.InputJsonValue,
            negative: item.negative as unknown as Prisma.InputJsonValue,
            caveats: [...verdict.caveats, ...item.caveats] as unknown as Prisma.InputJsonValue,
            role: item.role,
          };
        }),
      },
    },
    select: { id: true },
  });
  const buyRun = await client.recommendationRun.create({
    data: {
      kind: "BUY",
      context: buyContext,
      items: {
        create: buyItems.map((item, index) => ({
          wishlistEntry: { connect: { id: item.id } },
          rank: index + 1,
          score: item.score,
          positive: item.positive as unknown as Prisma.InputJsonValue,
          negative: item.negative as unknown as Prisma.InputJsonValue,
          caveats: item.caveats as unknown as Prisma.InputJsonValue,
          role: item.role,
        })),
      },
    },
    select: { id: true },
  });
  return { playNextRunId: playNextRun.id, buyRunId: buyRun.id };
}


function parseStoredTune(value: unknown): TuneContext | null {
  const parsed = tuneContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function pruneAndRebuild(client: Prisma.TransactionClient, now: Date) {
  const pruneCutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruned = await client.recommendationRun.deleteMany({
    where: { createdAt: { lt: pruneCutoff } },
  });
  const prunedEvents = await pruneRecommendationEvents(client, now);
  const profile = await rebuildRecommendationProfile(client, now);
  const tuneState = await client.recommendationTuneState.findUnique({
    where: { id: 1 },
    select: { playTune: true, buyTune: true },
  });

  return {
    pruned,
    prunedEvents,
    profile,
    playTune: parseStoredTune(tuneState?.playTune),
    buyTune: parseStoredTune(tuneState?.buyTune),
  };
}


export async function runRecommendationPipeline(tx: Prisma.TransactionClient) {
      const now = new Date();
      const { pruned, prunedEvents, profile, playTune, buyTune } = await pruneAndRebuild(tx, now);

      const rows = await loadCandidates(tx);
      const candidates: PlayNextCandidate[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        libraryEntry: row.libraryEntry,
      }));
      const eligible = candidates.filter(isEligibleForPlayNext);
      const { candidates: buyCandidates, wishViews } = await loadBuyCandidates(tx);
      const buyEligibleList = buyCandidates.filter(isEligibleForBuy);
      const playIds = eligible.map((candidate) => candidate.id);
      const buyIds = buyEligibleList.map((candidate) => candidate.id);
      const dismissalCounts = await loadDismissalCounts(tx, playIds, buyIds);
      const latestExposures = await loadLatestExposures(tx, playIds, buyIds);
      const playExposure = filterStaleExposures(eligible, latestExposures.play, now, 4);
      const buyExposure = filterStaleExposures(buyEligibleList, latestExposures.buy, now, 3);
      const playPoolIds = new Set(playExposure.candidates.map((candidate) => candidate.id));
      const secondChanceCandidateIds = new Set(
        playExposure.candidates
          .filter((candidate) => candidate.libraryEntry?.playState === "ABANDONED" && candidate.libraryEntry.replayCandidate)
          .map((candidate) => candidate.id),
      );
      const buyPoolIds = new Set(buyExposure.candidates.map((candidate) => candidate.id));
      const enteredPlayInterest = new Map(candidates.map((candidate) => [
        candidate.id,
        candidate.libraryEntry?.interest ?? null,
      ]));
      const calibratedCandidates = candidates.map((candidate) => ({
        ...candidate,
        libraryEntry: candidate.libraryEntry
          ? {
              ...candidate.libraryEntry,
              interest: calibratedInterest(
                candidate.libraryEntry.interest,
                dismissalCounts.get(calibrationKey("PLAY_NEXT", candidate.id)) ?? 0,
              ),
            }
          : null,
      }));
      const baselinePool = appendCalibration(
        rankAllPlayNextCandidates(calibratedCandidates.filter((candidate) => playPoolIds.has(candidate.id))),
        "PLAY_NEXT",
        enteredPlayInterest,
        dismissalCounts,
      );
      const secondChanceIds = baselinePool
        .filter((candidate) => secondChanceCandidateIds.has(candidate.id))
        .map((candidate) => candidate.id);
      const evidenceById = new Map(rows.map((row) => [row.id, compatEvidenceFor(row)]));
      const rowById = new Map(rows.map((row) => [row.id, row]));
      const preferences = (await tx.recommendationPreference.findMany()) as TastePreference[];
      const playTuneInputs = new Map(rows.map((row) => [
        row.id,
        tuneInput(row.metadataSnapshots[0]?.payload, row.libraryEntry?.gameExperience ?? null),
      ]));
      const playPool = baselinePool.map((item) => ({ ...item, caveats: [] as ExplanationCaveat[] }));
      const tunedPlayPool = applyTune(playPool, playTune, playTuneInputs, 4);
      const sourceNamesById = new Map(
        rows.flatMap((row) =>
          row.availability.flatMap((availability) =>
            availability.alternativeSourceId && availability.alternativeSource?.name
              ? [[availability.alternativeSourceId, availability.alternativeSource.name] as const]
              : [],
          ),
        ),
      );
      const sourceTunedPlayPool = applySourceTune(
        tunedPlayPool.map((item) => ({
          ...item,
          sources: (rowById.get(item.id)?.availability ?? []).map((availability): CandidateSource => ({
            source: availability.source,
            alternativeSourceId: availability.alternativeSourceId ?? null,
          })),
        })),
        playTune?.sourceTune,
        sourceNamesById,
      );

      const { playRerank, playRoles, playPoolById, playItems } = buildPlayPipeline(
        sourceTunedPlayPool,
        rowById,
        profile,
        preferences,
        now,
        secondChanceIds,
      );

      const enteredBuyInterest = new Map(buyCandidates.map((candidate) => [candidate.id, candidate.interest]));
      const calibratedBuyCandidates = buyCandidates.map((candidate) => ({
        ...candidate,
        interest: calibratedInterest(
          candidate.interest,
          dismissalCounts.get(calibrationKey("BUY", candidate.id)) ?? 0,
        ),
      }));
      const calibratedBuyById = new Map(calibratedBuyCandidates.map((candidate) => [candidate.id, candidate]));
      const buyBaselinePool = appendCalibration(
        rankAllBuyCandidates(
          calibratedBuyCandidates.filter((candidate) => buyPoolIds.has(candidate.id)),
          now,
        ),
        "BUY",
        enteredBuyInterest,
        dismissalCounts,
      );
      const buyTuneInputs = new Map(
        [...wishViews.entries()].map(([id, view]) => [id, tuneInput(view.payload, view.gameExperience)]),
      );
      const tunedBuyPool = applyTune(buyBaselinePool, buyTune, buyTuneInputs, 3);
      const { buyRerank, buyRoles, buyPoolById, buyItems } = buildBuyPipeline(
        tunedBuyPool,
        calibratedBuyById,
        wishViews,
        profile,
        preferences,
        now,
      );

      const context = {
        eligible: { playNext: eligible.length, buy: buyEligibleList.length },
        prunedRuns: pruned.count,
        prunedEvents,
        profile: { rebuiltAt: now.toISOString(), eventsConsidered: profile.evidence.eventsConsidered },
        tune: { play: playTune, buy: null, thinPool: Boolean(playTune && countTuneMatches(playTune, tunedPlayPool.map((item) => playTuneInputs.get(item.id) ?? {}), 4).thinPool) },
      };
      const { playContext: playContextJson, buyContext: buyContextJson } = buildRecommendationContexts({
        baseContext: context,
        playStaleExcluded: playExposure.staleExcluded,
        buyStaleExcluded: buyExposure.staleExcluded,
        playRerankContext: playRerank.context,
        buyRerankContext: buyRerank.context,
        playRoles,
        buyRoles,
        playPoolById,
        buyPoolById,
        playTune,
        buyTune,
        tunedBuyPool,
        buyTuneInputs,
      });

      const { playNextRunId, buyRunId } = await persistRecommendationRuns(
        tx,
        playContextJson,
        buyContextJson,
        playItems,
        buyItems,
        evidenceById,
        now,
      );

      return {
        playNextRunId,
        buyRunId,
        playNextItems: playItems.length,
        playNextEligible: eligible.length,
        buyItems: buyItems.length,
        buyEligible: buyEligibleList.length,
        prunedRuns: pruned.count,
        prunedEvents,
        profile: { rebuiltAt: now.toISOString(), eventsConsidered: profile.evidence.eventsConsidered },
      };
}
