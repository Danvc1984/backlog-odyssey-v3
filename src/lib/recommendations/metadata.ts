import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";

export interface RecommendationMetadata {
  genres: string[];
  tags: string[];
  publishers: string[];
  releaseDate: string | null;
  esrbRating: { name: string } | null;
  seriesGames: Array<{ name: string }>;
  gameModes: string[];
  multiplayerModes: string[];
  rating: number | null;
  ratingCount: number | null;
  ratingSource: "IGDB_TOTAL" | "IGDB_AGGREGATED" | null;
}

export function parseRecommendationMetadata(value: unknown): RecommendationMetadata | null {
  const parsed = parseIgdbMetadataPayload(value);
  if (!parsed) return null;

  const seriesGames = [
    ...(parsed.collection ? [{ name: parsed.collection.name }] : []),
    ...(parsed.franchise ? [{ name: parsed.franchise.name }] : []),
  ];
  const source = parsed.ratings.total.score !== null ? parsed.ratings.total : parsed.ratings.aggregated;
  const rating = source.score === null ? null : source.score / 20;
  const ratingCount = source.count;

  return {
    genres: parsed.genres.map((entry) => entry.name).filter(Boolean),
    tags: [
      ...parsed.themes.map((entry) => entry.name),
      ...parsed.keywords.map((entry) => entry.name),
      ...parsed.gameModes,
      ...parsed.multiplayerModes,
    ].filter(Boolean),
    publishers: parsed.publishers.map((entry) => entry.name).filter(Boolean),
    releaseDate: parsed.firstReleaseDate,
    esrbRating: parsed.esrbRating ? { name: parsed.esrbRating } : null,
    seriesGames,
    gameModes: parsed.gameModes,
    multiplayerModes: parsed.multiplayerModes,
    rating,
    ratingCount,
    ratingSource: parsed.ratings.total.score !== null ? "IGDB_TOTAL" : parsed.ratings.aggregated.score !== null ? "IGDB_AGGREGATED" : null,
  };
}
