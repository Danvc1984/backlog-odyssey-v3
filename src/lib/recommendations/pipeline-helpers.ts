import "server-only";

import { Prisma, type CompatibilityStatus, type Environment } from "@/generated/prisma/client";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { parseRecommendationMetadata } from "@/lib/recommendations/metadata";
import { resolveWishlistDurationEstimate, type DurationProfile } from "@/lib/playtime-evidence";
import { type BuyCandidate, type BuyOffer } from "@/lib/recommendations/buy";
import { buildCalibrationFactor } from "@/lib/recommendations/calibration";
import { countTuneMatches, matchTuneCriteria, type TuneCandidateInput } from "@/lib/recommendations/tune";
import type { CompatEvidenceInput, ExplanationCaveat, ExplanationFactor, TuneContext } from "@/lib/recommendations/types";

export async function loadCandidates(client: Prisma.TransactionClient) {
  return client.game.findMany({
    where: { type: "BASE_GAME", libraryEntry: { isNot: null } },
    select: {
      id: true,
      name: true,
      type: true,
      libraryEntry: {
        select: {
          playState: true,
          completedBefore: true,
          priority: true,
          interest: true,
          playSoon: true,
          replayCandidate: true,
          hidden: true,
          isMainGame: true,
          gameExperience: true,
          preferredEnvironment: true,
          handheldSuitable: true,
          compatOverrideStatus: true,
          compatOverrideReason: true,
        },
      },
      tags: { select: { tag: { select: { name: true } } } },
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
        where: { provider: "IGDB" },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { payload: true },
      },
      playtimeEvidence: { select: { provider: true, payload: true } },
      envCompat: { select: { environment: true, status: true } },
    },
  });
}
export function compatEvidenceFor(row: {
  externalIds: { externalId: string }[];
  availability: { source: "STEAM" | "OTHER_PLATFORM" | "ROM" }[];
  libraryEntry?: { compatOverrideStatus: CompatEvidenceInput["overrideStatus"]; compatOverrideReason: string | null } | null;
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
    overrideStatus: row.libraryEntry?.compatOverrideStatus ?? null,
    overrideReason: row.libraryEntry?.compatOverrideReason ?? null,
    protonDbStatus: protonDb?.status ?? null,
    protonDbFetchedAt: protonDbSnapshot?.fetchedAt ?? null,
    awayStatus: antiCheat?.status ?? null,
  };
}

export function compatEvidenceForWish(row: {
  type: "BASE_GAME" | "DLC";
  steamAppId: string | null;
  steamAppIdProvenance: string | null;
  compatSnapshots?: { provider: string; result: unknown; fetchedAt: Date }[];
  envCompat?: { environment: Environment; status: CompatibilityStatus }[];
}): CompatEvidenceInput | null {
  if (row.type === "DLC") return null;

  const hasSteamIdentity = Boolean(row.steamAppId?.trim() && row.steamAppIdProvenance?.trim());
  const protonDbSnapshot = (row.compatSnapshots ?? []).find(
    (snapshot) => snapshot.provider === "PROTONDB",
  );
  const awaySnapshot = (row.compatSnapshots ?? []).find(
    (snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET",
  );
  const protonDb = hasSteamIdentity && row.steamAppId && protonDbSnapshot
    ? parseProtonDbSummary(row.steamAppId, protonDbSnapshot.result)
    : null;
  const antiCheat = hasSteamIdentity ? parseAntiCheatEvidence(awaySnapshot?.result) : null;

  return {
    hasSteamIdentity,
    romOnly: false,
    overrideStatus: null,
    overrideReason: null,
    protonDbStatus: protonDb?.status ?? null,
    protonDbFetchedAt: hasSteamIdentity ? protonDbSnapshot?.fetchedAt ?? null : null,
    awayStatus: antiCheat?.status ?? null,
  };
}

export async function loadBuyCandidates(
  client: Prisma.TransactionClient,
  durationProfile: DurationProfile = "NORMALLY",
) {
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
      handheldSuitable: true,
      steamAppId: true,
      steamAppIdProvenance: true,
      metadataSnapshot: { select: { payload: true } },
      compatSnapshots: { select: { provider: true, result: true, fetchedAt: true } },
      envCompat: { select: { environment: true, status: true } },
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
    return {
      candidates: [] as BuyCandidate[],
      wishViews: new Map<string, {
        payload: unknown;
        gameExperience: string | null;
        durationHours: number | null;
        handheldSuitable: boolean | null;
        compatEvidence: CompatEvidenceInput | null;
        envCompat: { environment: Environment; status: CompatibilityStatus }[];
        personalTags: string[];
      }>(),
    };
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
          completedBefore: true,
          replayCandidate: true,
        },
      },
      tags: { select: { tag: { select: { name: true } } } },
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
        {
          payload: entry.metadataSnapshot?.payload ?? null,
          gameExperience: entry.gameExperience ?? null,
          durationHours: resolveWishlistDurationEstimate(entry.metadataSnapshot?.payload, durationProfile)?.hours ?? null,
          handheldSuitable: entry.handheldSuitable,
          compatEvidence: compatEvidenceForWish(entry),
          envCompat: entry.envCompat ?? [],
          personalTags: entry.baseGameId ? (baseById.get(entry.baseGameId)?.tags ?? []).map(({ tag }) => tag.name) : [],
        },
      ]),
    ),
  };
}

export function tuneInput(
  payload: unknown,
  experience: string | null,
  durationHours: number | null = null,
  handheldSuitable: boolean | null = null,
  personalTags: string[] = [],
): TuneCandidateInput {
  const parsed = parseRecommendationMetadata(payload);
  return parsed
    ? {
        experience,
        releaseDate: parsed.releaseDate,
        genres: parsed.genres,
        tags: parsed.tags,
        personalTags,
        esrbRating: parsed.esrbRating,
        seriesGames: parsed.seriesGames,
        gameModes: parsed.gameModes,
        multiplayerModes: parsed.multiplayerModes,
        durationHours,
        handheldSuitable,
      }
    : { experience, durationHours, handheldSuitable, personalTags };
}

type CalibrationKind = "PLAY_NEXT" | "BUY";

export function calibrationKey(kind: CalibrationKind, id: string): string {
  return `${kind}:${id}`;
}

export async function loadDismissalCounts(
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

export async function loadLatestExposures(
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

export function appendCalibration<T extends { id: string; negative: ExplanationFactor[] }>(
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

export function applyTune<T extends { id: string; score: number; positive: ExplanationFactor[]; negative: ExplanationFactor[]; caveats?: ExplanationCaveat[] }>(
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
    const personalTagMatched = match.criteria.includes("personal tag");
    const regularCriteria = match.criteria.filter((criterion) => criterion !== "personal tag");
    const personalTagPoints = match.personalTagPoints ?? 0;
    const regularPoints = Math.max(0, match.points - personalTagPoints);
    if (regularPoints > 0) {
      positive.push({ factor: "tune_match", label: `Tuned for ${regularCriteria.join(", ")}`, points: regularPoints });
    }
    if (personalTagMatched && personalTagPoints > 0) {
      positive.push({ factor: "tune_match", label: "Matches your personal tag shelf", points: personalTagPoints });
    }
    if (match.points === 0 && thinPool) {
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
