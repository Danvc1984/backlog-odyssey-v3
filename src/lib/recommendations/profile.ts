import type {
  Prisma,
  RecommendationDimension,
  RecommendationEventKind,
} from "@/generated/prisma/client";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";

export const PROFILE_DECAY_HALF_LIFE_DAYS = 180;

export const EVENT_SIGNAL_WEIGHTS: Partial<Record<RecommendationEventKind, number>> = {
  START: 1,
  COMPLETION: 2,
  ABANDONMENT: -1,
  DISMISSAL: -1.5,
};

export interface ProfileDimensionSignal {
  weight: number;
  support: number;
  lastAt: string;
}

export interface RecommendationProfilePayload {
  version: 1;
  windowStart: string | null;
  windowEnd: string;
  dimensions: Record<RecommendationDimension, Record<string, ProfileDimensionSignal>>;
  evidence: {
    eventsConsidered: number;
    byKind: Partial<Record<RecommendationEventKind, number>>;
    unresolvedTargets: number;
  };
}

export function tasteSetupWeight(answer: string): number {
  if (answer === "LIKED") return 2;
  if (answer === "PLAYED") return 1;
  return 0;
}

export function decayFactor(ageDays: number): number {
  return 0.5 ** (Math.max(0, ageDays) / PROFILE_DECAY_HALF_LIFE_DAYS);
}

export function durationBand(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours)) return null;
  if (hours <= 5) return "SHORT";
  if (hours <= 15) return "MEDIUM";
  if (hours <= 40) return "LONG";
  return "VERY_LONG";
}

export function eraBucket(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const date = new Date(releaseDate);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 2005) return "PRE_2005";
  if (year <= 2014) return "Y2005_2014";
  if (year <= 2019) return "Y2015_2019";
  return "Y2020_PLUS";
}

export function profileDimensionKeys(): RecommendationDimension[] {
  return [
    "GENRE",
    "TAG",
    "EXPERIENCE",
    "DURATION",
    "PUBLISHER",
    "ERA",
    "SERIES",
    "ENVIRONMENT",
    "MATURITY",
  ];
}

interface ProfileEvent {
  kind: RecommendationEventKind;
  gameId: string | null;
  wishlistEntryId: string | null;
  createdAt: Date;
  payload: unknown;
  game: {
    libraryEntry: { gameExperience: string | null; preferredEnvironment: string | null } | null;
    metadataSnapshots: { payload: unknown }[];
  } | null;
  wishlistEntry: {
    gameExperience: string | null;
    metadataSnapshot: { payload: unknown } | null;
  } | null;
}

type DimensionValues = Partial<Record<RecommendationDimension, string[]>>;

function metadataValues(payload: unknown): DimensionValues {
  const parsed = parseRawgMetadataPayload(payload);
  if (!parsed) return {};
  return {
    GENRE: parsed.genres,
    TAG: parsed.tags,
    PUBLISHER: parsed.publishers.slice(0, 1),
    ERA: parsed.releaseDate ? [eraBucket(parsed.releaseDate)].filter((value): value is string => value !== null) : [],
    MATURITY: parsed.esrbRating?.name ? [parsed.esrbRating.name] : [],
    SERIES: (parsed.seriesGames ?? []).map((entry) => entry.name),
    DURATION: durationBand(parsed.playtimeHours) ? [durationBand(parsed.playtimeHours)!] : [],
  };
}

function mergeValues(base: DimensionValues, extra: DimensionValues): DimensionValues {
  for (const [dimension, values] of Object.entries(extra) as [RecommendationDimension, string[]][]) {
    base[dimension] = [...(base[dimension] ?? []), ...values.filter(Boolean)];
  }
  return base;
}

function eventValues(event: ProfileEvent): DimensionValues | null {
  const source = event.gameId ? event.game : event.wishlistEntry;
  if (!source) return null;
  const values = event.game
    ? mergeValues({}, metadataValues(event.game.metadataSnapshots[0]?.payload))
    : mergeValues({}, metadataValues(event.wishlistEntry?.metadataSnapshot?.payload));
  const entry = event.game?.libraryEntry;
  const experience = event.game?.libraryEntry?.gameExperience ?? event.wishlistEntry?.gameExperience;
  if (experience) values.EXPERIENCE = [experience];
  if (entry?.preferredEnvironment) values.ENVIRONMENT = [entry.preferredEnvironment];
  const answer = typeof event.payload === "object" && event.payload !== null
    ? (event.payload as { answer?: unknown }).answer
    : null;
  if (event.kind === "TASTE_SETUP_ANSWER" && typeof answer === "string") {
    const weight = tasteSetupWeight(answer);
    return weight === 0 ? values : values;
  }
  return values;
}

export async function rebuildRecommendationProfile(
  client: Prisma.TransactionClient,
  now = new Date(),
): Promise<RecommendationProfilePayload> {
  const events = await client.recommendationEvent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      game: { include: { libraryEntry: true, metadataSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } },
      wishlistEntry: { include: { metadataSnapshot: true } },
    },
  }) as unknown as ProfileEvent[];
  const dimensions = Object.fromEntries(profileDimensionKeys().map((key) => [key, {}])) as RecommendationProfilePayload["dimensions"];
  const byKind: Partial<Record<RecommendationEventKind, number>> = {};
  let unresolvedTargets = 0;
  for (const event of events) {
    if (event.kind === "EXPOSURE" || event.kind === "ROTATION") continue;
    byKind[event.kind] = (byKind[event.kind] ?? 0) + 1;
    const values = eventValues(event);
    if (!values) { unresolvedTargets += 1; continue; }
    const baseWeight = event.kind === "TASTE_SETUP_ANSWER"
      ? tasteSetupWeight(typeof (event.payload as { answer?: unknown } | null)?.answer === "string" ? (event.payload as { answer: string }).answer : "SKIPPED")
      : EVENT_SIGNAL_WEIGHTS[event.kind] ?? 0;
    if (baseWeight === 0) continue;
    const weight = baseWeight * decayFactor((now.getTime() - event.createdAt.getTime()) / 86400000);
    for (const [dimension, names] of Object.entries(values) as [RecommendationDimension, string[]][]) {
      for (const name of new Set(names)) {
        const signal = dimensions[dimension][name] ?? { weight: 0, support: 0, lastAt: event.createdAt.toISOString() };
        signal.weight += weight;
        signal.support += 1;
        if (event.createdAt > new Date(signal.lastAt)) signal.lastAt = event.createdAt.toISOString();
        dimensions[dimension][name] = signal;
      }
    }
  }
  const payload: RecommendationProfilePayload = {
    version: 1,
    windowStart: events[0]?.createdAt.toISOString() ?? null,
    windowEnd: now.toISOString(),
    dimensions,
    evidence: { eventsConsidered: events.filter((event) => !["EXPOSURE", "ROTATION"].includes(event.kind)).length, byKind, unresolvedTargets },
  };
  const jsonPayload = payload as unknown as Prisma.InputJsonValue;
  await client.recommendationProfile.upsert({ where: { id: 1 }, create: { id: 1, payload: jsonPayload }, update: { payload: jsonPayload, rebuiltAt: now } });
  return payload;
}
