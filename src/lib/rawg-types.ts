export type RawgMatchMethod =
  | "EXACT_STEAM_APP_ID"
  | "MANUAL_RAWG_SEARCH";

export const RAWG_EXTERNAL_NAMESPACE = "RAWG_GAME" as const;
export const RAWG_METADATA_SCHEMA_VERSION = 3 as const;

export interface RawgPalette {
  primary: string;
  dark: string;
  muted: string;
}

export type RawgProviderErrorCategory =
  | "CONFIGURATION"
  | "NETWORK"
  | "HTTP"
  | "MALFORMED_RESPONSE";

export interface RawgProviderError {
  category: RawgProviderErrorCategory;
  message: string;
  status?: number;
}

export interface RawgNamedValue {
  id: number;
  name: string;
  slug: string | null;
}

export interface RawgEsrbRating {
  name: string;
  slug: string | null;
}

export interface RawgSeriesEntry {
  rawgId: number;
  name: string;
  slug: string | null;
  released: string | null;
}

export interface RawgScreenshotEntry {
  rawgId: number;
  image: string;
  width: number | null;
  height: number | null;
}

export interface RawgStoreEntry {
  storeSlug: string | null;
  storeName: string | null;
  url: string | null;
}

export interface RawgGameDetails {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  released: string | null;
  backgroundImage: string | null;
  backgroundImageAdditional: string | null;
  genres: RawgNamedValue[];
  tags: RawgNamedValue[];
  developers: RawgNamedValue[];
  publishers: RawgNamedValue[];
  website: string | null;
  rating: number | null;
  metacritic: number | null;
  playtime: number | null;
  alternativeNames: string[];
  rawgUpdatedAt: string | null;
  rawgUrl: string;
  stores: RawgStoreEntry[];
  esrbRating: RawgEsrbRating | null;
  seriesGames: RawgSeriesEntry[];
  screenshots: RawgScreenshotEntry[];
  palette: RawgPalette | null;
}

export interface RawgSearchCandidate {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  backgroundImage: string | null;
}

export type RawgMatchResult =
  | {
      outcome: "MATCHED";
      matchMethod: RawgMatchMethod;
      game: RawgGameDetails;
    }
  | {
      outcome: "AMBIGUOUS";
      candidates: RawgSearchCandidate[];
    }
  | {
      outcome: "NOT_FOUND";
    }
  | {
      outcome: "UNAVAILABLE";
      error: RawgProviderError;
    };

export interface RawgMatchRequest {
  title: string;
  selectedRawgId?: number | null;
}

export interface RawgMetadataAttribution {
  provider: "RAWG";
  sourceUrl: string;
  fetchedAt: string;
}

export interface RawgMetadataPayload {
  schemaVersion: typeof RAWG_METADATA_SCHEMA_VERSION;
  rawgId: number;
  rawgSlug: string;
  title: string;
  description: string | null;
  releaseDate: string | null;
  backgroundImageUrls: string[];
  genres: string[];
  tags: string[];
  developers: string[];
  publishers: string[];
  website: string | null;
  rating: number | null;
  metacriticScore: number | null;
  playtimeHours: number | null;
  alternativeNames: string[];
  rawgUrl: string;
  attribution: RawgMetadataAttribution;
  esrbRating: RawgEsrbRating | null;
  seriesGames: RawgSeriesEntry[];
  palette: RawgPalette | null;
  screenshots: RawgScreenshotEntry[];
}

export interface WishlistStoreLink {
  steamUrl: string;
  steamAppId: string;
}

export interface RawgWishlistMetadataPayload extends RawgMetadataPayload {
  storeLink: WishlistStoreLink | null;
}

export type RawgPersistenceErrorCode =
  | "NOT_MATCHED"
  | "RAWG_ID_CONFLICT"
  | "PERSISTENCE_FAILED";

export interface RawgPersistenceError {
  code: RawgPersistenceErrorCode;
  message: string;
}

export type RawgPersistenceResult =
  | {
      success: true;
      data: { gameId: string; rawgId: number; fetchedAt: Date };
      error: null;
    }
  | {
      success: false;
      data: null;
      error: RawgPersistenceError;
    };
