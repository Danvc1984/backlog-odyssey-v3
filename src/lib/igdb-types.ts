export const IGDB_EXTERNAL_NAMESPACE = "IGDB_GAME" as const;
export const IGDB_METADATA_SCHEMA_VERSION = 1 as const;
export const IGDB_STEAM_EXTERNAL_CATEGORY = 1 as const;

export type IgdbMatchMethod =
  | "EXACT_STEAM_APP_ID"
  | "INFERRED"
  | "MANUAL_IGDB_SEARCH";

export type IgdbProviderErrorCategory =
  | "CONFIGURATION"
  | "NETWORK"
  | "HTTP"
  | "MALFORMED_RESPONSE";

export interface IgdbProviderError {
  category: IgdbProviderErrorCategory;
  message: string;
  status?: number;
}

export type IgdbCategoryClass = "MAIN_GAME" | "DLC" | "NEVER_AUTO";

export interface IgdbSearchCandidate {
  id: number;
  slug: string;
  name: string;
  alternativeNames: string[];
  category: number | null;
  firstReleaseDate: string | null;
  coverUrl: string | null;
  score?: number;
}

export interface IgdbGameResponse {
  id: number;
  slug?: string | null;
  name?: string | null;
  summary?: string | null;
  first_release_date?: number | null;
  genres?: Array<{ id?: number; name?: string | null }> | null;
  themes?: Array<{ id?: number; name?: string | null }> | null;
  keywords?: Array<{ id?: number; name?: string | null }> | null;
  involved_companies?: Array<{
    company?: { id?: number; name?: string | null } | null;
    developer?: boolean | null;
    publisher?: boolean | null;
  }> | null;
  age_ratings?: Array<{
    category?: number | null;
    rating?: number | null;
  }> | null;
  websites?: Array<{ url?: string | null; category?: number | null }> | null;
  alternative_names?: Array<{ name?: string | null }> | null;
  collection?: { id?: number; name?: string | null } | null;
  franchise?: { id?: number; name?: string | null } | null;
  game_type?: number | null;
  category?: number | null;
  game_modes?: Array<{ id?: number; name?: string | null }> | null;
  multiplayer_modes?: Array<{
    campaigncoop?: boolean | null;
    dropin?: boolean | null;
    lan?: boolean | null;
    offlinecoop?: boolean | null;
    onlinecoop?: boolean | null;
    splitscreen?: boolean | null;
    splitscreenonline?: boolean | null;
  }> | null;
  dlcs?: Array<{ id?: number; name?: string | null }> | null;
  expansions?: Array<{ id?: number; name?: string | null }> | null;
  expanded_games?: Array<{ id?: number; name?: string | null }> | null;
  forks?: Array<{ id?: number; name?: string | null }> | null;
  ports?: Array<{ id?: number; name?: string | null }> | null;
  remakes?: Array<{ id?: number; name?: string | null }> | null;
  remasters?: Array<{ id?: number; name?: string | null }> | null;
  standalone_expansions?: Array<{ id?: number; name?: string | null }> | null;
  cover?: { image_id?: string | null } | null;
  artworks?: Array<{
    image_id?: string | null;
    image_type?: { name?: string | null } | null;
  }> | null;
  screenshots?: Array<{
    image_id?: string | null;
    width?: number | null;
    height?: number | null;
  }> | null;
  aggregated_rating?: number | null;
  aggregated_rating_count?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  total_rating?: number | null;
  total_rating_count?: number | null;
  updated_at?: number | null;
}

export interface IgdbMatchRequest {
  title: string;
  category: IgdbCategoryClass;
  steamAppId?: string | null;
  selectedIgdbId?: number | null;
}

export type IgdbMatchResult =
  | {
      outcome: "MATCHED";
      matchMethod: IgdbMatchMethod;
      game: IgdbGameResponse;
      classMismatch?: boolean;
    }
  | { outcome: "AMBIGUOUS"; candidates: IgdbSearchCandidate[] }
  | { outcome: "NOT_FOUND" }
  | { outcome: "UNAVAILABLE"; error: IgdbProviderError };

export interface IgdbNamedValue {
  id: number;
  name: string;
}

export interface IgdbRating {
  score: number | null;
  count: number | null;
}

export interface IgdbRelation {
  kind: string;
  igdbId: number;
  name: string;
}

export interface IgdbScreenshot {
  image: string;
  width: number | null;
  height: number | null;
}

export interface IgdbPalette {
  primary: string;
  dark: string;
  muted: string;
}

export interface IgdbMetadataAttribution {
  provider: "IGDB";
  sourceUrl: string;
  fetchedAt: string;
}

export interface IgdbMetadataPayload {
  schemaVersion: typeof IGDB_METADATA_SCHEMA_VERSION;
  igdbId: number | null;
  igdbSlug: string | null;
  name: string | null;
  summary: string | null;
  firstReleaseDate: string | null;
  genres: IgdbNamedValue[];
  themes: IgdbNamedValue[];
  keywords: IgdbNamedValue[];
  developers: IgdbNamedValue[];
  publishers: IgdbNamedValue[];
  esrbRating: string | null;
  officialWebsite: string | null;
  alternativeNames: string[];
  ratings: {
    aggregated: IgdbRating;
    community: IgdbRating;
    total: IgdbRating;
  };
  collection: IgdbNamedValue | null;
  franchise: IgdbNamedValue | null;
  relations: IgdbRelation[];
  gameModes: string[];
  multiplayerModes: string[];
  coverUrl: string | null;
  artworkUrls: string[];
  conceptArtUrls?: string[];
  screenshots: IgdbScreenshot[];
  igdbUpdatedAt: string | null;
  attribution: IgdbMetadataAttribution;
  palette: IgdbPalette | null;
}
