import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import type { IgdbMetadataPayload } from "@/lib/igdb-types";

export interface WishlistCardMetadataView {
  imageUrl: string | null;
  wideImageUrl: string | null;
  description: string | null;
  genres: string[];
  developers: string[];
  releaseDate: string | null;
  rating: number | null;
  durationHours: number | null;
}

export interface CoverArtMeta {
  genres: string[];
  description: string | null;
  developers: string[];
  releaseDate: string | null;
  rating: number | null;
  metacriticScore: number | null;
  playtimeHours: number | null;
  esrbName: string | null;
}

export interface LibraryCardMetadataView extends CoverArtMeta {
  imageUrl: string | null;
  wideImageUrl?: string | null;
}

export function igdbWishlistCardMetadataView(
  value: unknown,
  durationHours: number | null = null,
): WishlistCardMetadataView | null {
  const payload = parseIgdbMetadataPayload(value);
  if (!payload) return null;

  return {
    imageUrl: payload.coverUrl,
    wideImageUrl: payload.artworkUrls[0] ?? payload.screenshots[0]?.image ?? payload.coverUrl,
    description: payload.summary,
    genres: payload.genres.map((genre) => genre.name),
    developers: payload.developers.map((developer) => developer.name),
    releaseDate: payload.firstReleaseDate,
    rating: payload.ratings.total.score ?? payload.ratings.aggregated.score,
    durationHours,
  };
}

function parseIgdbCardPayload(value: unknown): IgdbMetadataPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const payload = value as Partial<IgdbMetadataPayload>;
  return payload.schemaVersion === 1 && typeof payload.name === "string" &&
    (payload.summary === null || typeof payload.summary === "string") && Array.isArray(payload.genres) &&
    Array.isArray(payload.developers) && payload.ratings !== null &&
    typeof payload.ratings === "object"
    ? (value as IgdbMetadataPayload)
    : null;
}

export function igdbLibraryCardMetadataView(
  value: unknown,
  durationHours: number | null = null,
): LibraryCardMetadataView | null {
  const payload = parseIgdbCardPayload(value);
  if (!payload) return null;
  const rating = payload.ratings.total.score ?? payload.ratings.aggregated.score;
  return {
    imageUrl: payload.coverUrl,
    wideImageUrl: payload.artworkUrls[0] ?? payload.screenshots[0]?.image ?? payload.coverUrl,
    genres: payload.genres.map((genre) => genre.name),
    description: payload.summary,
    developers: payload.developers.map((developer) => developer.name),
    releaseDate: payload.firstReleaseDate,
    rating,
    metacriticScore: null,
    playtimeHours: durationHours,
    esrbName: payload.esrbRating,
  };
}

export function libraryCardMetadataView(
  value: unknown,
): LibraryCardMetadataView | null {
  const payload = parseRawgMetadataPayload(value);
  if (!payload) return null;

  return {
    imageUrl: payload.backgroundImageUrls[0] ?? null,
    genres: payload.genres,
    description: payload.description,
    developers: payload.developers,
    releaseDate: payload.releaseDate,
    rating: payload.rating,
    metacriticScore: payload.metacriticScore,
    playtimeHours: payload.playtimeHours,
    esrbName: payload.esrbRating?.name ?? null,
  };
}
