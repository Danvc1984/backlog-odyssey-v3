import { describe, expect, it } from "vitest";

import {
  WALLPAPER_IN_PROGRESS_POOL_SIZE,
  WALLPAPER_MAIN_POOL_SIZE,
  WALLPAPER_MAX_SEARCHES_PER_REFRESH,
  WALLPAPER_POOL_STALE_MS,
  WALLPAPER_QUERY_VERSION,
  WALLPAPER_REFRESH_THROTTLE_MS,
  buildSearchPlan,
  dailyIndexFor,
  dayStringInMexicoCity,
  isPoolStale,
  parseWallpaperCandidate,
  parseWallpaperPool,
  parseWallpaperRenderTarget,
  pickShuffleIndex,
  resolveWallpaperSelection,
  type WallpaperCandidate,
  type WallpaperGameReference,
} from "./wallpaper";

const candidate = (id: string): WallpaperCandidate => ({
  id,
  pageUrl: `https://wallhaven.cc/w/${id}`,
  imageUrl: `https://images.example.test/${id}.jpg`,
  width: 1920,
  height: 1080,
  fileType: "jpg",
  uploader: null,
});

const pool = {
  queryVersion: WALLPAPER_QUERY_VERSION,
  fetchedAt: "2026-09-03T00:00:00.000Z",
  mode: "MAIN_GAME" as const,
  searched: [{ gameId: "main", name: "Main Game" }],
  items: [candidate("one"), candidate("two"), candidate("three")],
};

describe("wallpaper parsers", () => {
  it("read valid candidates, pools, and render targets", () => {
    expect(parseWallpaperCandidate(candidate("one"))).toEqual(candidate("one"));
    expect(parseWallpaperPool(pool)).toEqual(pool);
    expect(parseWallpaperRenderTarget({ day: "2026-09-03", source: "shuffle" })).toEqual({
      day: "2026-09-03",
      source: "shuffle",
    });
  });

  it("treat malformed stored values as absent", () => {
    expect(parseWallpaperCandidate({ id: "bad" })).toBeNull();
    expect(parseWallpaperPool({ ...pool, items: [{ ...candidate("one"), fileType: "gif" }] })).toBeNull();
    expect(parseWallpaperPool({ ...pool, fetchedAt: "not-a-date" })).toBeNull();
    expect(parseWallpaperPool({ ...pool, queryVersion: 1 })).toBeNull();
    expect(parseWallpaperRenderTarget({ day: "today", source: "shuffle" })).toBeNull();
  });
});

describe("wallpaper day and selection", () => {
  it("uses the Mexico City local day", () => {
    expect(dayStringInMexicoCity(new Date("2026-09-03T05:59:00.000Z"))).toBe("2026-09-02");
    expect(dayStringInMexicoCity(new Date("2026-09-03T06:00:00.000Z"))).toBe("2026-09-03");
  });

  it("keeps a daily index stable and changes it from yesterday", () => {
    const today = dailyIndexFor("2026-09-03", 10);
    expect(today).toBe(dailyIndexFor("2026-09-03", 10));
    expect(today).not.toBe(dailyIndexFor("2026-09-02", 10));
    expect(dailyIndexFor("2026-09-03", 0)).toBe(-1);
  });

  it("uses a same-day shuffle and returns to daily selection the next day", () => {
    const shuffled = resolveWallpaperSelection(
      {
        candidates: pool,
        selectedIdx: 1,
        renderTarget: { day: "2026-09-03", source: "shuffle" },
      },
      new Date("2026-09-03T12:00:00.000Z"),
    );
    const nextDay = resolveWallpaperSelection(
      {
        candidates: pool,
        selectedIdx: 1,
        renderTarget: { day: "2026-09-03", source: "shuffle" },
      },
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(shuffled).toMatchObject({ candidate: candidate("two"), index: 1, source: "shuffle" });
    expect(nextDay).toMatchObject({ index: dailyIndexFor("2026-09-04", 3), source: "daily" });
  });

  it("falls back to the daily index when a shuffle index is outside a replacement pool", () => {
    const selection = resolveWallpaperSelection(
      {
        candidates: { ...pool, items: [candidate("only-one")] },
        selectedIdx: 4,
        renderTarget: { day: "2026-09-03", source: "shuffle" },
      },
      new Date("2026-09-03T12:00:00.000Z"),
    );
    expect(selection).toMatchObject({ candidate: candidate("only-one"), index: 0, source: "daily" });
  });
});

describe("wallpaper freshness and search planning", () => {
  const main: WallpaperGameReference = {
    id: "main",
    name: "Main Game",
    updatedAt: new Date("2026-09-03T12:00:00.000Z"),
  };
  const inProgress: WallpaperGameReference[] = [
    { id: "zulu", name: "Zulu", updatedAt: new Date("2026-09-01T00:00:00.000Z") },
    { id: "alpha", name: "alpha", updatedAt: new Date("2026-09-03T00:00:00.000Z") },
    main,
    { id: "bravo", name: "Bravo", updatedAt: new Date("2026-09-02T00:00:00.000Z") },
    { id: "charlie", name: "Charlie", updatedAt: new Date("2026-09-02T00:00:00.000Z") },
  ];

  it("uses only the main game for a ten-image pool", () => {
    expect(buildSearchPlan(main, inProgress)).toEqual({
      mode: "MAIN_GAME",
      terms: [{ gameId: "main", name: "Main Game" }],
      poolSize: WALLPAPER_MAIN_POOL_SIZE,
      imagesPerTerm: WALLPAPER_MAIN_POOL_SIZE,
    });
  });

  it("uses the most recently updated in-progress games with an equal quota", () => {
    const noMainPlan = buildSearchPlan(null, inProgress);

    expect(noMainPlan).toEqual({
      mode: "IN_PROGRESS",
      terms: [
        { gameId: "main", name: "Main Game" },
        { gameId: "alpha", name: "alpha" },
        { gameId: "bravo", name: "Bravo" },
        { gameId: "charlie", name: "Charlie" },
        { gameId: "zulu", name: "Zulu" },
      ],
      poolSize: WALLPAPER_IN_PROGRESS_POOL_SIZE,
      imagesPerTerm: 4,
    });
    expect(noMainPlan.terms).toHaveLength(Math.min(inProgress.length, WALLPAPER_MAX_SEARCHES_PER_REFRESH));

    const sixGamePlan = buildSearchPlan(null, [
      ...inProgress,
      { id: "delta", name: "Delta", updatedAt: new Date("2026-09-01T00:00:00.000Z") },
      { id: "echo", name: "Echo", updatedAt: new Date("2026-08-31T00:00:00.000Z") },
    ]);
    expect(sixGamePlan.terms).toHaveLength(6);
    expect(sixGamePlan.imagesPerTerm).toBe(3);
    expect(sixGamePlan.terms.map((term) => term.gameId)).not.toContain("echo");
  });

  it.each([
    [1, 20],
    [2, 10],
    [3, 6],
    [4, 5],
    [5, 4],
    [6, 3],
  ])("apportions %i in-progress games to %i images per game", (gameCount, imagesPerTerm) => {
    const games = Array.from({ length: gameCount }, (_, index) => ({
      id: `game-${index}`,
      name: `Game ${index}`,
      updatedAt: new Date(`2026-09-${String(6 - index).padStart(2, "0")}T00:00:00.000Z`),
    }));

    expect(buildSearchPlan(null, games)).toMatchObject({
      mode: "IN_PROGRESS",
      poolSize: WALLPAPER_IN_PROGRESS_POOL_SIZE,
      imagesPerTerm,
    });
  });

  it("detects age and ordered source changes, while throttling unchanged sources", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const plan = buildSearchPlan(main, inProgress);
    const fresh = { candidates: pool, cachedAt: new Date(now.getTime() - 1_000), lastAttemptAt: null };

    expect(isPoolStale(fresh, plan, now)).toBe(false);
    expect(isPoolStale({ ...fresh, cachedAt: new Date(now.getTime() - WALLPAPER_POOL_STALE_MS) }, plan, now)).toBe(true);
    expect(isPoolStale({ ...fresh, candidates: { ...pool, searched: [{ gameId: "other", name: "Other" }] } }, plan, now)).toBe(true);
    expect(isPoolStale({ ...fresh, lastAttemptAt: new Date(now.getTime() - WALLPAPER_REFRESH_THROTTLE_MS + 1) }, plan, now)).toBe(false);
    expect(isPoolStale({
      ...fresh,
      candidates: { ...pool, searched: [{ gameId: "other", name: "Other" }] },
      lastAttemptAt: new Date(now.getTime() - 1_000),
    }, plan, now)).toBe(true);
    const noMainPlan = buildSearchPlan(null, [main]);
    expect(isPoolStale({
      ...fresh,
      candidates: { ...pool, mode: "IN_PROGRESS", searched: noMainPlan.terms },
    }, plan, now)).toBe(true);
  });
});

describe("wallpaper shuffle", () => {
  it("returns a different random index", () => {
    expect(pickShuffleIndex(4, 1, () => 0)).toBe(0);
    expect(pickShuffleIndex(4, 1, () => 0.99)).toBe(3);
    expect(pickShuffleIndex(0, 0, () => 0)).toBeNull();
    expect(pickShuffleIndex(1, 0, () => 0)).toBe(0);
  });
});
