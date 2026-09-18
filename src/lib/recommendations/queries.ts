import { prisma } from "@/lib/prisma";
import { parseRecommendationMetadata } from "@/lib/recommendations/metadata";

const KNOWN_VALUES_CACHE_TTL_MS = 10 * 60 * 1000;
export type KnownGenreTagValues = { genres: string[]; tags: string[]; personalTags: string[] };

let knownValuesCache: { data: KnownGenreTagValues; expiresAt: number } | null = null;

export function resetKnownGenreTagValuesCache() {
  knownValuesCache = null;
}

export async function loadKnownGenreTagValues(): Promise<KnownGenreTagValues> {
  if (knownValuesCache && knownValuesCache.expiresAt > Date.now()) {
    return knownValuesCache.data;
  }

  const [games, wishlistEntries, personalTags] = await Promise.all([
    prisma.game.findMany({
      select: {
        metadataSnapshots: {
          where: { provider: "IGDB" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    }),
    prisma.wishlistEntry.findMany({
      select: { metadataSnapshot: { select: { payload: true } } },
    }),
    prisma.personalTag?.findMany
      ? prisma.personalTag.findMany({ select: { name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const genres = new Set<string>();
  const tags = new Set<string>();
  for (const payload of [
    ...games.flatMap((game) => game.metadataSnapshots.map((snapshot) => snapshot.payload)),
    ...wishlistEntries.map((entry) => entry.metadataSnapshot?.payload),
  ]) {
    const parsed = parseRecommendationMetadata(payload);
    for (const genre of parsed?.genres ?? []) if (genre) genres.add(genre);
    for (const tag of parsed?.tags ?? []) if (tag) tags.add(tag);
  }
  const data = { genres: [...genres].sort(), tags: [...tags].sort(), personalTags: personalTags.map(({ name }) => name) };
  knownValuesCache = { data, expiresAt: Date.now() + KNOWN_VALUES_CACHE_TTL_MS };
  return data;
}

export async function loadRecommendationPresets() {
  return prisma.recommendationPreset.findMany({ orderBy: { name: "asc" } });
}
