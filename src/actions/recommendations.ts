"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { Prisma, RecommendationRole } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { prisma } from "@/lib/prisma";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { buildCompatContext } from "@/lib/recommendations/compat-context";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import {
  isEligibleForBuy,
  getBuyDealInputs,
  rankAllBuyCandidates,
  type BuyCandidate,
  type BuyOffer,
} from "@/lib/recommendations/buy";
import {
  isEligibleForPlayNext,
  rankAllPlayNextCandidates,
} from "@/lib/recommendations/play-next";
import {
  rerankBuyCandidates,
  rerankPlayCandidates,
  type RerankBuyInput,
  type RerankPlayInput,
  type TastePreference,
} from "@/lib/recommendations/rerank";
import { assignBuyRoles, assignPlayRoles } from "@/lib/recommendations/roles";
import { resolveCandidateDimensionValues } from "@/lib/recommendations/profile";
import {
  applySourceTune,
  countTuneMatches,
  matchTuneCriteria,
  type CandidateSource,
  type TuneCandidateInput,
} from "@/lib/recommendations/tune";
import type {
  CompatEvidenceInput,
  ExplanationCaveat,
  ExplanationFactor,
  PlayNextCandidate,
  RotatableCandidate,
  TuneContext,
} from "@/lib/recommendations/types";
import { tuneContextSchema } from "@/lib/recommendations/types";
import { EXPOSURE_COOLDOWN_DAYS, RUN_RETENTION_DAYS } from "@/lib/recommendations/types";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import { pruneRecommendationEvents } from "@/lib/recommendations/events";
import { rebuildRecommendationProfile } from "@/lib/recommendations/profile";
import { buildCalibrationFactor, calibratedInterest } from "@/lib/recommendations/calibration";
import { filterStaleExposures } from "@/lib/recommendations/exposure";
import { updatePlayState } from "@/actions/game-detail";

const KNOWN_VALUES_CACHE_TTL_MS = 10 * 60 * 1000;
type KnownGenreTagValues = { genres: string[]; tags: string[] };
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
          gameExperience: true,
          preferredEnvironment: true,
        },
      },
      externalIds: { select: { externalId: true } },
      availability: {
        select: {
          source: true,
          alternativeSourceId: true,
          alternativeSource: { select: { name: true } },
          steamPlaytimeTotal: true,
          steamLastPlayed: true,
        },
      },
      compatSnapshots: {
        select: { provider: true, result: true, fetchedAt: true },
      },
      metadataSnapshots: {
        where: { provider: "RAWG" },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { payload: true },
      },
      envCompat: { select: { environment: true, status: true } },
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
      gameExperience: true,
      metadataSnapshot: { select: { payload: true } },
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
    return { candidates: [] as BuyCandidate[], wishViews: new Map<string, { payload: unknown; gameExperience: string | null }>() };
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

  return {
    candidates: entries.map((entry): BuyCandidate => ({
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
    })),
    wishViews: new Map(
      entries.map((entry) => [
        entry.id,
        { payload: entry.metadataSnapshot?.payload ?? null, gameExperience: entry.gameExperience ?? null },
      ]),
    ),
  };
}

interface SnapshotSource {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

type BatchEntry = string | RotatableCandidate;

function parseStoredTune(value: unknown): TuneContext | null {
  const parsed = tuneContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function tuneInput(payload: unknown, experience: string | null): TuneCandidateInput {
  const parsed = parseRawgMetadataPayload(payload);
  return parsed
    ? {
        rawgId: parsed.rawgId,
        experience,
        playtimeHours: parsed.playtimeHours,
        releaseDate: parsed.releaseDate,
        genres: parsed.genres,
        tags: parsed.tags,
        esrbRating: parsed.esrbRating,
        seriesGames: parsed.seriesGames,
      }
    : { experience };
}

type CalibrationKind = "PLAY_NEXT" | "BUY";

function calibrationKey(kind: CalibrationKind, id: string): string {
  return `${kind}:${id}`;
}

async function loadDismissalCounts(
  client: Prisma.TransactionClient,
  playIds: string[],
  buyIds: string[],
): Promise<ReadonlyMap<string, number>> {
  const clauses = [
    ...(playIds.length > 0 ? [{ gameId: { in: playIds }, kind: "PLAY_NEXT" as const }] : []),
    ...(buyIds.length > 0 ? [{ wishlistEntryId: { in: buyIds }, kind: "BUY" as const }] : []),
  ];
  if (clauses.length === 0) return new Map();
  const rows = await client.recommendationFeedback.groupBy({
    by: ["gameId", "wishlistEntryId", "kind"],
    where: { OR: clauses },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = row.kind === "PLAY_NEXT" ? row.gameId : row.wishlistEntryId;
    if (id) counts.set(calibrationKey(row.kind, id), row._count._all);
  }
  return counts;
}

async function loadLatestExposures(
  client: Prisma.TransactionClient,
  playIds: string[],
  buyIds: string[],
): Promise<{ play: ReadonlyMap<string, Date>; buy: ReadonlyMap<string, Date> }> {
  const clauses = [
    ...(playIds.length > 0 ? [{ gameId: { in: playIds } }] : []),
    ...(buyIds.length > 0 ? [{ wishlistEntryId: { in: buyIds } }] : []),
  ];
  if (clauses.length === 0) return { play: new Map(), buy: new Map() };

  const rows = await client.recommendationEvent.findMany({
    where: {
      kind: { in: ["EXPOSURE", "ROTATION"] },
      OR: clauses,
    },
    select: { gameId: true, wishlistEntryId: true, createdAt: true },
  });
  const play = new Map<string, Date>();
  const buy = new Map<string, Date>();
  for (const row of rows) {
    const target = row.gameId ? play : row.wishlistEntryId ? buy : null;
    const id = row.gameId ?? row.wishlistEntryId;
    if (!target || !id || (target.get(id)?.getTime() ?? Number.NEGATIVE_INFINITY) >= row.createdAt.getTime()) continue;
    target.set(id, row.createdAt);
  }
  return { play, buy };
}

function appendCalibration<T extends { id: string; negative: ExplanationFactor[] }>(
  pool: T[],
  kind: CalibrationKind,
  enteredInterest: ReadonlyMap<string, number | null>,
  dismissalCounts: ReadonlyMap<string, number>,
): T[] {
  return pool.map((item) => {
    const factor = buildCalibrationFactor(
      enteredInterest.get(item.id) ?? null,
      dismissalCounts.get(calibrationKey(kind, item.id)) ?? 0,
    );
    return factor ? { ...item, negative: [...item.negative, factor] } : item;
  });
}

function applyTune<T extends { id: string; score: number; positive: ExplanationFactor[]; negative: ExplanationFactor[]; caveats?: ExplanationCaveat[] }>(
  pool: T[],
  tune: TuneContext | null,
  inputs: ReadonlyMap<string, TuneCandidateInput>,
  displayCount: number,
): T[] {
  if (!tune) return pool;
  const matches = pool.map((item) => matchTuneCriteria(tune, inputs.get(item.id) ?? {}));
  const thinPool = countTuneMatches(tune, pool.map((item) => inputs.get(item.id) ?? {}), displayCount).thinPool;
  return pool.map((item, index) => {
    const match = matches[index];
    const positive = [...item.positive];
    const caveats = [...(item.caveats ?? [])];
    if (match.points > 0) {
      positive.push({ factor: "tune_match", label: `Tuned for ${match.criteria.join(", ")}`, points: match.points });
    } else if (thinPool) {
      caveats.push({ factor: "tune_thin_pool", label: `Only ${matches.filter((entry) => entry.points > 0).length} candidates match your tune` });
    }
    return {
      ...item,
      score: item.score + match.points,
      positive,
      caveats,
    };
  }).sort((left, right) => right.score - left.score);
}

function candidateId(entry: BatchEntry): string {
  return typeof entry === "string" ? entry : entry.id;
}

function toRotatableCandidate(entry: BatchEntry): RotatableCandidate {
  if (typeof entry !== "string") return entry;
  return { id: entry, score: 0, positive: [], negative: [], caveats: [] };
}

function toSnapshotBatches(
  batches: Record<RecommendationRole, string[]>,
  byId: ReadonlyMap<string, SnapshotSource>,
): Record<RecommendationRole, RotatableCandidate[]> {
  const result = {} as Record<RecommendationRole, RotatableCandidate[]>;
  for (const role of Object.keys(batches) as RecommendationRole[]) {
    result[role] = (batches[role] ?? [])
      .map((id) => byId.get(id))
      .filter((source): source is SnapshotSource => source !== undefined)
      .map((source) => ({
        id: source.id,
        score: source.score,
        positive: source.positive,
        negative: source.negative,
        caveats: source.caveats,
      }));
  }
  return result;
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
      const tuneState = await tx.recommendationTuneState.findUnique({
        where: { id: 1 },
        select: { playTune: true, buyTune: true },
      });
      const playTune = parseStoredTune(tuneState?.playTune);
      const buyTune = parseStoredTune(tuneState?.buyTune);

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
      const buyCandidateById = new Map(buyCandidates.map((candidate) => [candidate.id, candidate]));
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

      const rerankInputs: RerankPlayInput[] = sourceTunedPlayPool.map((item) => {
        const row = rowById.get(item.id)!;
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
          interest: calibratedBuyById.get(item.id)?.interest ?? null,
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

      const context = {
        eligible: { playNext: eligible.length, buy: buyEligibleList.length },
        prunedRuns: pruned.count,
        prunedEvents,
        profile: { rebuiltAt: now.toISOString(), eventsConsidered: profile.evidence.eventsConsidered },
        tune: { play: playTune, buy: null, thinPool: Boolean(playTune && countTuneMatches(playTune, tunedPlayPool.map((item) => playTuneInputs.get(item.id) ?? {}), 4).thinPool) },
      };
      const playContextJson = {
        ...context,
        staleExcluded: playExposure.staleExcluded,
        rerank: playRerank.context,
        roles: { batches: toSnapshotBatches(playRoles.batches, playPoolById) },
      } as unknown as Prisma.InputJsonValue;
      const buyContextJson = {
        ...context,
        staleExcluded: buyExposure.staleExcluded,
        tune: { play: playTune, buy: buyTune, thinPool: Boolean(buyTune && countTuneMatches(buyTune, tunedBuyPool.map((item) => buyTuneInputs.get(item.id) ?? {}), 3).thinPool) },
        rerank: buyRerank.context,
        roles: { batches: toSnapshotBatches(buyRoles.batches, buyPoolById), saturation: buyRoles.saturation },
      } as unknown as Prisma.InputJsonValue;

      const playNextRun = await tx.recommendationRun.create({
        data: {
          kind: "PLAY_NEXT",
          context: playContextJson,
          items: {
            create: playItems.map((item, index) => {
              const evidence = evidenceById.get(item.id)!;
              const verdict = buildCompatContext(evidence, now);
              const positive: ExplanationFactor[] = [
                ...item.positive,
                ...verdict.positives,
              ];
              const negative: ExplanationFactor[] = [...item.negative];
              const caveats: ExplanationCaveat[] = [...verdict.caveats, ...item.caveats];
              return {
                game: { connect: { id: item.id } },
                rank: index + 1,
                score: item.score,
                positive: positive as unknown as Prisma.InputJsonValue,
                negative: negative as unknown as Prisma.InputJsonValue,
                caveats: caveats as unknown as Prisma.InputJsonValue,
                role: item.role,
              };
            }),
          },
        },
        select: { id: true },
      });

      const buyRun = await tx.recommendationRun.create({
        data: {
          kind: "BUY",
          context: buyContextJson,
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

      return {
        playNextRunId: playNextRun.id,
        buyRunId: buyRun.id,
        playNextItems: playItems.length,
        playNextEligible: eligible.length,
        buyItems: buyItems.length,
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
