import type {
  IgdbGameResponse,
  IgdbMetadataPayload,
  IgdbNamedValue,
  IgdbRelation,
  IgdbScreenshot,
} from "./igdb-types";
import { IGDB_METADATA_SCHEMA_VERSION } from "./igdb-types";

const GAME_MODE_LABELS: Readonly<Record<number, string>> = {
  1: "Single-player",
  2: "Multiplayer",
  3: "Co-operative",
  4: "Split-screen",
  5: "Massively multiplayer online",
  6: "Battle royale",
};

const ESRB_LABELS: Readonly<Record<number, string>> = {
  1: "Rating Pending",
  2: "Early Childhood",
  3: "Everyone",
  4: "Everyone 10+",
  5: "Teen",
  6: "Mature",
  7: "Adults Only",
};

const RELATIONS: ReadonlyArray<[keyof IgdbGameResponse, string]> = [
  ["dlcs", "DLC"],
  ["expansions", "Expansion"],
  ["expanded_games", "Expanded game"],
  ["forks", "Fork"],
  ["ports", "Port"],
  ["remakes", "Remake"],
  ["remasters", "Remaster"],
  ["standalone_expansions", "Standalone expansion"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nullableDate(seconds: unknown): string | null {
  if (!positiveInteger(seconds)) return null;
  const date = new Date(seconds * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function namedValues(value: unknown): IgdbNamedValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !positiveInteger(item.id) || typeof item.name !== "string" || !item.name.trim()) return [];
    return [{ id: item.id, name: item.name }];
  });
}

function imageUrl(imageId: unknown, size: string): string | null {
  return typeof imageId === "string" && imageId.trim()
    ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
    : null;
}

function companyValues(value: unknown, role: "developer" | "publisher"): IgdbNamedValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || item[role] !== true || !isRecord(item.company) || !positiveInteger(item.company.id) || typeof item.company.name !== "string") return [];
    return item.company.name.trim() ? [{ id: item.company.id, name: item.company.name }] : [];
  });
}

function gameModes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => isRecord(item) && positiveInteger(item.id) && GAME_MODE_LABELS[item.id] ? [GAME_MODE_LABELS[item.id]] : [])
    : [];
}

function multiplayerModes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: Array<[string, string]> = [
    ["campaigncoop", "Campaign co-op"],
    ["dropin", "Drop-in"],
    ["lan", "LAN"],
    ["offlinecoop", "Offline co-op"],
    ["onlinecoop", "Online co-op"],
    ["splitscreen", "Split-screen"],
    ["splitscreenonline", "Split-screen online"],
  ];
  return [...new Set(value.flatMap((item) => isRecord(item) ? labels.flatMap(([key, label]) => item[key] === true ? [label] : []) : []))];
}

function relations(game: IgdbGameResponse): IgdbRelation[] {
  return RELATIONS.flatMap(([field, kind]) => namedValues(game[field]).map(({ id, name }) => ({ kind, igdbId: id, name })));
}

function screenshots(value: unknown): IgdbScreenshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const image = imageUrl(item.image_id, "t_screenshot_big");
    if (!image) return [];
    return [{
      image,
      width: typeof item.width === "number" && Number.isFinite(item.width) ? item.width : null,
      height: typeof item.height === "number" && Number.isFinite(item.height) ? item.height : null,
    }];
  }).slice(0, 6);
}

function rating(value: unknown, count: unknown) {
  return {
    score: typeof value === "number" && Number.isFinite(value) ? value : null,
    count: typeof count === "number" && Number.isFinite(count) ? count : null,
  };
}

export function parseIgdbGameToPayload(
  game: IgdbGameResponse,
  fetchedAt = new Date(),
): IgdbMetadataPayload {
  const raw: Record<string, unknown> = isRecord(game) ? game : {};
  const slug = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug : null;
  const cover = isRecord(raw.cover) ? imageUrl(raw.cover.image_id, "t_cover_big") : null;
  const artworks = Array.isArray(raw.artworks)
    ? raw.artworks.flatMap((item) => isRecord(item) ? imageUrl(item.image_id, "t_720p") ?? [] : []).slice(0, 6)
    : [];
  const esrb = Array.isArray(raw.age_ratings)
    ? raw.age_ratings.find((item) => isRecord(item) && item.category === 1 && positiveInteger(item.rating))
    : null;
  const officialWebsite = Array.isArray(raw.websites)
    ? raw.websites.find((item) => isRecord(item) && item.category === 1 && typeof item.url === "string")
    : null;

  return {
    schemaVersion: IGDB_METADATA_SCHEMA_VERSION,
    igdbId: positiveInteger(raw.id) ? raw.id : null,
    igdbSlug: slug,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : null,
    summary: typeof raw.summary === "string" ? raw.summary : null,
    firstReleaseDate: nullableDate(raw.first_release_date),
    genres: namedValues(raw.genres),
    themes: namedValues(raw.themes),
    keywords: namedValues(raw.keywords),
    developers: companyValues(raw.involved_companies, "developer"),
    publishers: companyValues(raw.involved_companies, "publisher"),
    esrbRating: esrb && isRecord(esrb) ? ESRB_LABELS[esrb.rating as number] ?? null : null,
    officialWebsite: officialWebsite && isRecord(officialWebsite) && typeof officialWebsite.url === "string" ? officialWebsite.url : null,
    alternativeNames: Array.isArray(raw.alternative_names) ? raw.alternative_names.flatMap((item) => isRecord(item) && typeof item.name === "string" && item.name.trim() ? [item.name] : []) : [],
    ratings: {
      aggregated: rating(raw.aggregated_rating, raw.aggregated_rating_count),
      community: rating(raw.rating, raw.rating_count),
      total: rating(raw.total_rating, raw.total_rating_count),
    },
    collection: namedValues(raw.collection ? [raw.collection] : [])[0] ?? null,
    franchise: namedValues(raw.franchise ? [raw.franchise] : [])[0] ?? null,
    relations: relations(raw as unknown as IgdbGameResponse),
    gameModes: gameModes(raw.game_modes),
    multiplayerModes: multiplayerModes(raw.multiplayer_modes),
    coverUrl: cover,
    artworkUrls: artworks,
    screenshots: screenshots(raw.screenshots),
    igdbUpdatedAt: nullableDate(raw.updated_at),
    attribution: {
      provider: "IGDB",
      sourceUrl: slug ? `https://www.igdb.com/games/${slug}` : "",
      fetchedAt: fetchedAt.toISOString(),
    },
    palette: null,
  };
}
