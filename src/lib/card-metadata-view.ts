import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";

export interface WishlistCardMetadataView {
  imageUrl: string | null;
  description: string | null;
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
}

export function wishlistCardMetadataView(
  value: unknown,
): WishlistCardMetadataView | null {
  const payload = parseRawgMetadataPayload(value);
  if (!payload) return null;

  return {
    imageUrl: payload.backgroundImageUrls[0] ?? null,
    description: payload.description,
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
