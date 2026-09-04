import { z } from "zod";

export const DEFAULT_WALLPAPER_TIME_ZONE = "America/Mexico_City";
export const WALLPAPER_MAIN_POOL_SIZE = 10;
export const WALLPAPER_IN_PROGRESS_POOL_SIZE = 20;
export const WALLPAPER_MAX_IN_PROGRESS_GAMES = 6;
export const WALLPAPER_MIN_IMAGES_PER_IN_PROGRESS_GAME = 3;
export const WALLPAPER_MAX_SEARCHES_PER_REFRESH = WALLPAPER_MAX_IN_PROGRESS_GAMES;
export const WALLPAPER_POOL_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const WALLPAPER_REFRESH_THROTTLE_MS = 60 * 60 * 1000;
export const WALLPAPER_QUERY_VERSION = 3;

export interface WallpaperCandidate {
  id: string;
  pageUrl: string;
  imageUrl: string;
  width: number;
  height: number;
  fileType: "jpg" | "png";
  uploader: string | null;
}

export interface WallpaperSearchTerm {
  gameId: string | null;
  name: string;
}

export interface WallpaperPool {
  queryVersion: number;
  fetchedAt: string;
  mode: WallpaperPoolMode;
  searched: WallpaperSearchTerm[];
  items: WallpaperCandidate[];
}

export type WallpaperPoolMode = "MAIN_GAME" | "IN_PROGRESS";

export interface WallpaperSearchPlan {
  mode: WallpaperPoolMode;
  terms: WallpaperSearchTerm[];
  poolSize: number;
  imagesPerTerm: number;
}

export interface WallpaperRenderTarget {
  day: string;
  source: "daily" | "shuffle";
}

export interface WallpaperSelection {
  candidate: WallpaperCandidate;
  index: number;
  source: WallpaperRenderTarget["source"];
}

export interface WallpaperGameReference {
  id: string | null;
  name: string;
  updatedAt: Date;
}

export interface WallpaperSelectionState {
  candidates: unknown;
  selectedIdx: number | null | undefined;
  renderTarget: unknown;
}

export interface WallpaperFreshnessState {
  candidates: unknown;
  cachedAt: Date | null;
  lastAttemptAt: Date | null;
}

export const wallpaperCandidateSchema = z.object({
  id: z.string().min(1),
  pageUrl: z.string().url(),
  imageUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fileType: z.enum(["jpg", "png"]),
  uploader: z.string().nullable(),
});

const wallpaperSearchTermSchema = z.object({
  gameId: z.string().nullable(),
  name: z.string().min(1),
});

export const wallpaperPoolSchema = z.object({
  queryVersion: z.literal(WALLPAPER_QUERY_VERSION),
  fetchedAt: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value))),
  mode: z.enum(["MAIN_GAME", "IN_PROGRESS"]),
  searched: z.array(wallpaperSearchTermSchema).max(WALLPAPER_MAX_SEARCHES_PER_REFRESH),
  items: z.array(wallpaperCandidateSchema).max(WALLPAPER_IN_PROGRESS_POOL_SIZE),
});

export const wallpaperRenderTargetSchema = z.object({
  day: z.string().refine((value) => parseDay(value) !== null),
  source: z.enum(["daily", "shuffle"]),
});

export function parseWallpaperCandidate(value: unknown): WallpaperCandidate | null {
  const result = wallpaperCandidateSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWallpaperPool(value: unknown): WallpaperPool | null {
  const result = wallpaperPoolSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWallpaperRenderTarget(value: unknown): WallpaperRenderTarget | null {
  const result = wallpaperRenderTargetSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function dayStringInMexicoCity(
  value: Date | number,
  timeZone = DEFAULT_WALLPAPER_TIME_ZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Wallpaper date must be valid");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function dailyIndexFor(day: string, poolSize: number): number {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    return -1;
  }
  if (poolSize === 1) {
    return 0;
  }

  const targetDate = parseDay(day);
  if (!targetDate) {
    return stableHash(day) % poolSize;
  }

  const anchor = day < "1970-01-01" ? "0001-01-01" : "1970-01-01";
  let currentDay = anchor;
  let currentIndex = stableHash(currentDay) % poolSize;
  while (currentDay < day) {
    currentDay = nextDayString(currentDay);
    const rawIndex = stableHash(currentDay) % poolSize;
    currentIndex = rawIndex === currentIndex ? (rawIndex + 1) % poolSize : rawIndex;
  }
  return currentIndex;
}

export function resolveWallpaperSelection(
  state: WallpaperSelectionState,
  now = new Date(),
  timeZone = DEFAULT_WALLPAPER_TIME_ZONE,
): WallpaperSelection | null {
  const pool = parseWallpaperPool(state.candidates);
  if (!pool || pool.items.length === 0) {
    return null;
  }

  const today = dayStringInMexicoCity(now, timeZone);
  const renderTarget = parseWallpaperRenderTarget(state.renderTarget);
  const isCurrentShuffle =
    renderTarget?.day === today &&
    renderTarget.source === "shuffle" &&
    isValidIndex(state.selectedIdx, pool.items.length);
  const index = isCurrentShuffle
    ? state.selectedIdx!
    : dailyIndexFor(today, pool.items.length);

  return {
    candidate: pool.items[index],
    index,
    source: isCurrentShuffle ? "shuffle" : "daily",
  };
}

export function isWallpaperRefreshThrottled(
  lastAttemptAt: Date | null,
  now: Date,
): boolean {
  return (
    lastAttemptAt !== null &&
    now.getTime() - lastAttemptAt.getTime() < WALLPAPER_REFRESH_THROTTLE_MS
  );
}

export function isPoolStale(
  state: WallpaperFreshnessState | null,
  currentPlan: WallpaperSearchPlan,
  now: Date,
): boolean {
  const storedPool = state ? parseWallpaperPool(state.candidates) : null;
  if (!state?.cachedAt || Number.isNaN(state.cachedAt.getTime()) || !storedPool) {
    return true;
  }
  if (storedPool.mode !== currentPlan.mode || !sameSourcePlan(storedPool.searched, currentPlan.terms)) {
    return true;
  }
  if (state && isWallpaperRefreshThrottled(state.lastAttemptAt, now)) {
    return false;
  }
  if (now.getTime() - state.cachedAt.getTime() >= WALLPAPER_POOL_STALE_MS) {
    return true;
  }

  return false;
}

export function buildSearchPlan(
  mainGame: WallpaperGameReference | null,
  inProgressGames: readonly WallpaperGameReference[],
): WallpaperSearchPlan {
  if (mainGame) {
    return {
      mode: "MAIN_GAME",
      terms: [{ gameId: mainGame.id, name: mainGame.name }],
      poolSize: WALLPAPER_MAIN_POOL_SIZE,
      imagesPerTerm: WALLPAPER_MAIN_POOL_SIZE,
    };
  }

  const selectedGames = [...inProgressGames].sort((left, right) => {
    const updatedAtOrder = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (updatedAtOrder) {
      return updatedAtOrder;
    }
    const nameOrder = left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    return nameOrder || (left.id ?? "").localeCompare(right.id ?? "");
  }).slice(0, WALLPAPER_MAX_IN_PROGRESS_GAMES);
  const terms = selectedGames.map(({ id, name }) => ({ gameId: id, name }));

  return {
    mode: "IN_PROGRESS",
    terms,
    poolSize: WALLPAPER_IN_PROGRESS_POOL_SIZE,
    imagesPerTerm: terms.length > 0
      ? Math.max(
        WALLPAPER_MIN_IMAGES_PER_IN_PROGRESS_GAME,
        Math.floor(WALLPAPER_IN_PROGRESS_POOL_SIZE / terms.length),
      )
      : 0,
  };
}

export function pickShuffleIndex(
  poolSize: number,
  currentIndex: number | null | undefined,
  random = Math.random,
): number | null {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    return null;
  }
  if (poolSize === 1) {
    return 0;
  }

  const randomValue = random();
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : 0;
  const offset = Math.floor(normalizedRandom * (poolSize - 1));
  if (!isValidIndex(currentIndex, poolSize)) {
    return offset;
  }
  return offset >= currentIndex ? offset + 1 : offset;
}

function sameSourcePlan(
  left: readonly WallpaperSearchTerm[],
  right: readonly WallpaperSearchTerm[],
): boolean {
  return (
    left.length === right.length &&
    left.every((source, index) => sourceKey(source) === sourceKey(right[index]))
  );
}

function sourceKey(source: WallpaperSearchTerm): string {
  return source.gameId ? `id:${source.gameId}` : `name:${source.name.toLocaleLowerCase("en")}`;
}

function isValidIndex(value: number | null | undefined, length: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length;
}

function parseDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().startsWith(`${day}T`) ? parsed : null;
}

function nextDayString(day: string): string {
  const next = parseDay(day);
  if (!next) {
    return day;
  }
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
