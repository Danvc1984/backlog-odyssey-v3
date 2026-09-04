import { describe, expect, it } from "vitest";

import {
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
  const main: WallpaperGameReference = { id: "main", name: "Main Game" };
  const inProgress: WallpaperGameReference[] = [
    { id: "zulu", name: "Zulu" },
    { id: "alpha", name: "alpha" },
    main,
    { id: "bravo", name: "Bravo" },
    { id: "charlie", name: "Charlie" },
  ];

  it("puts the main game first, sorts progress, excludes the main game, and caps terms", () => {
    expect(buildSearchPlan(main, inProgress)).toEqual([
      { gameId: "main", name: "Main Game" },
      { gameId: "alpha", name: "alpha" },
      { gameId: "bravo", name: "Bravo" },
      { gameId: "charlie", name: "Charlie" },
    ]);
    expect(buildSearchPlan(null, inProgress)).toHaveLength(WALLPAPER_MAX_SEARCHES_PER_REFRESH);
    expect(buildSearchPlan({ id: null, name: "Main Game" }, [{ id: null, name: "main game" }])).toEqual([
      { gameId: null, name: "Main Game" },
    ]);
  });

  it("detects age and ordered source changes, while throttling unchanged sources", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const sources = [{ gameId: "main", name: "Main Game" }];
    const fresh = { candidates: pool, cachedAt: new Date(now.getTime() - 1_000), lastAttemptAt: null };

    expect(isPoolStale(fresh, sources, now)).toBe(false);
    expect(isPoolStale({ ...fresh, cachedAt: new Date(now.getTime() - WALLPAPER_POOL_STALE_MS) }, sources, now)).toBe(true);
    expect(isPoolStale({ ...fresh, candidates: { ...pool, searched: [{ gameId: "other", name: "Other" }] } }, sources, now)).toBe(true);
    expect(isPoolStale({ ...fresh, lastAttemptAt: new Date(now.getTime() - WALLPAPER_REFRESH_THROTTLE_MS + 1) }, sources, now)).toBe(false);
    expect(isPoolStale({
      ...fresh,
      candidates: { ...pool, searched: [{ gameId: "other", name: "Other" }] },
      lastAttemptAt: new Date(now.getTime() - 1_000),
    }, sources, now)).toBe(true);
    const orderedSources = [
      { gameId: "main", name: "Main Game" },
      { gameId: "other", name: "Other" },
    ];
    expect(isPoolStale({
      ...fresh,
      candidates: { ...pool, searched: [...orderedSources].reverse() },
    }, orderedSources, now)).toBe(true);
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
