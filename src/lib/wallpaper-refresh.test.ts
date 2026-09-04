import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./wallhaven-api", () => ({ searchWallhaven: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { searchWallhaven } from "./wallhaven-api";
import { refreshWallpaperPool } from "./wallpaper-refresh";
import { WALLPAPER_QUERY_VERSION, type WallpaperCandidate } from "./wallpaper";

const findUnique = vi.fn();
const findMany = vi.fn();
const upsert = vi.fn();

const now = new Date("2026-09-03T12:00:00.000Z");

const candidate = (id: string): WallpaperCandidate => ({
  id,
  pageUrl: `https://wallhaven.cc/w/${id}`,
  imageUrl: `https://images.example.test/${id}.jpg`,
  width: 1920,
  height: 1080,
  fileType: "jpg",
  uploader: null,
});

const pool = (searched = [{ gameId: "main", name: "Main Game" }]) => ({
  queryVersion: WALLPAPER_QUERY_VERSION,
  fetchedAt: "2026-09-01T12:00:00.000Z",
  searched,
  items: [candidate("old")],
});

const state = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  candidates: pool(),
  selectedIdx: 0,
  renderTarget: null,
  cachedAt: new Date(now.getTime() - 1_000),
  lastAttemptAt: null,
  lastError: null,
  updatedAt: now,
  ...overrides,
});

const catalog = (...rows: Array<{ id: string; name: string; main?: boolean; inProgress?: boolean }>) =>
  rows.map(({ id, name, main = false, inProgress = false }) => ({
    id,
    name,
    libraryEntry: { isMainGame: main, playState: inProgress ? "IN_PROGRESS" : "NOT_STARTED" },
  }));

describe("refreshWallpaperPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { wallpaperState: unknown; game: unknown }).wallpaperState = {
      findUnique,
      upsert,
    };
    (prisma as unknown as { game: unknown }).game = { findMany };
    findUnique.mockResolvedValue(state());
    findMany.mockResolvedValue(catalog({ id: "main", name: "Main Game", main: true }));
    upsert.mockResolvedValue({});
    vi.mocked(searchWallhaven).mockResolvedValue({ ok: true, items: [] });
  });

  it("skips a fresh pool without searching or writing", async () => {
    const result = await refreshWallpaperPool(now);

    expect(result).toMatchObject({ success: true, status: "SKIPPED" });
    expect(searchWallhaven).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("throttles a stale pool after a recent attempt", async () => {
    findUnique.mockResolvedValue(state({
      cachedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      lastAttemptAt: new Date(now.getTime() - 1_000),
    }));

    const result = await refreshWallpaperPool(now);

    expect(result).toMatchObject({ success: true, status: "THROTTLED" });
    expect(searchWallhaven).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refreshes immediately when the catalog source set changes", async () => {
    findUnique.mockResolvedValue(state({
      candidates: pool([{ gameId: "old-main", name: "Old Main" }]),
      lastAttemptAt: new Date(now.getTime() - 1_000),
    }));
    findMany.mockResolvedValue(catalog({ id: "new-main", name: "New Main", main: true }));
    vi.mocked(searchWallhaven).mockResolvedValue({ ok: true, items: [candidate("new-wallpaper")] });

    const result = await refreshWallpaperPool(now);

    expect(result).toMatchObject({ success: true, status: "REFRESHED", itemCount: 1 });
    expect(searchWallhaven).toHaveBeenCalledWith("New Main");
  });

  it("refreshes when the main game changes position within the same source plan", async () => {
    findUnique.mockResolvedValue(state({
      candidates: pool([
        { gameId: "carrion", name: "CARRION" },
        { gameId: "total-war", name: "Total War: WARHAMMER III" },
      ]),
      lastAttemptAt: new Date(now.getTime() - 1_000),
    }));
    findMany.mockResolvedValue(catalog(
      { id: "carrion", name: "CARRION", inProgress: true },
      { id: "total-war", name: "Total War: WARHAMMER III", main: true, inProgress: true },
    ));
    vi.mocked(searchWallhaven).mockResolvedValue({ ok: true, items: [candidate("new-wallpaper")] });

    const result = await refreshWallpaperPool(now);

    expect(result).toMatchObject({ success: true, status: "REFRESHED" });
    expect(searchWallhaven).toHaveBeenNthCalledWith(1, "Total War: WARHAMMER III");
  });

  it("persists candidates and the searched source set after a successful refresh", async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue(catalog(
      { id: "main", name: "Main Game", main: true },
      { id: "zulu", name: "Zulu", inProgress: true },
      { id: "alpha", name: "Alpha", inProgress: true },
    ));
    vi.mocked(searchWallhaven)
      .mockResolvedValueOnce({ ok: true, items: [candidate("one")] })
      .mockResolvedValueOnce({ ok: true, items: [candidate("two")] })
      .mockResolvedValueOnce({ ok: true, items: [] });

    const result = await refreshWallpaperPool(now);
    const finalWrite = upsert.mock.calls.at(-1)?.[0];

    expect(result).toMatchObject({ success: true, status: "REFRESHED", itemCount: 2 });
    expect(vi.mocked(searchWallhaven).mock.calls.map(([term]) => term)).toEqual(["Main Game", "Alpha", "Zulu"]);
    expect(finalWrite).toMatchObject({
      update: {
        cachedAt: now,
        lastError: "Zulu: no results",
        candidates: {
          queryVersion: WALLPAPER_QUERY_VERSION,
          fetchedAt: now.toISOString(),
          searched: [
            { gameId: "main", name: "Main Game" },
            { gameId: "alpha", name: "Alpha" },
            { gameId: "zulu", name: "Zulu" },
          ],
        },
      },
    });
  });

  it("stores an empty pool when the catalog has no search terms", async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);

    const result = await refreshWallpaperPool(now);
    const finalWrite = upsert.mock.calls.at(-1)?.[0];

    expect(result).toMatchObject({ success: true, status: "REFRESHED", itemCount: 0, searched: [] });
    expect(searchWallhaven).not.toHaveBeenCalled();
    expect(finalWrite).toMatchObject({
      update: {
        cachedAt: now,
        lastError: null,
        candidates: {
          queryVersion: WALLPAPER_QUERY_VERSION,
          fetchedAt: now.toISOString(),
          searched: [],
          items: [],
        },
      },
    });
  });

  it("advances past empty results and deduplicates candidates", async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue(catalog(
      { id: "main", name: "Main Game", main: true },
      { id: "next", name: "Next", inProgress: true },
    ));
    vi.mocked(searchWallhaven)
      .mockResolvedValueOnce({ ok: true, items: [] })
      .mockResolvedValueOnce({ ok: true, items: [candidate("same"), candidate("same")] });

    const result = await refreshWallpaperPool(now);

    expect(result).toMatchObject({ success: true, itemCount: 1 });
    expect(searchWallhaven).toHaveBeenCalledTimes(2);
  });

  it("searches every planned term while keeping the pool cap", async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue(catalog(
      { id: "main", name: "Main Game", main: true },
      { id: "next", name: "Next", inProgress: true },
    ));
    vi.mocked(searchWallhaven)
      .mockResolvedValueOnce({
        ok: true,
        items: Array.from({ length: 10 }, (_, index) => candidate(`main-${index}`)),
      })
      .mockResolvedValueOnce({ ok: true, items: [candidate("next-only")] });

    const result = await refreshWallpaperPool(now);
    const finalWrite = upsert.mock.calls.at(-1)?.[0];

    expect(result).toMatchObject({ success: true, itemCount: 10 });
    expect(searchWallhaven).toHaveBeenCalledTimes(2);
    expect(finalWrite.update.candidates.items.map((item: WallpaperCandidate) => item.id)).toContain("next-only");
  });

  it("preserves the existing pool when every provider term fails", async () => {
    findUnique.mockResolvedValue(state({ cachedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) }));
    vi.mocked(searchWallhaven).mockResolvedValue({
      ok: false,
      error: { category: "HTTP", status: 503, message: "busy" },
    });

    const result = await refreshWallpaperPool(now);
    const finalWrite = upsert.mock.calls.at(-1)?.[0];

    expect(result).toMatchObject({ success: false, status: "FAILED", error: "Main Game: HTTP" });
    expect(finalWrite).toEqual({
      where: { id: 1 },
      create: { id: 1, lastAttemptAt: now, lastError: "Main Game: HTTP" },
      update: { lastAttemptAt: now, lastError: "Main Game: HTTP" },
    });
  });

  it("deduplicates concurrent refresh calls with one in-flight promise", async () => {
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue(catalog({ id: "main", name: "Main Game", main: true }));
    let resolveSearch: ((result: { ok: true; items: WallpaperCandidate[] }) => void) | undefined;
    const pendingSearch = new Promise<{ ok: true; items: WallpaperCandidate[] }>((resolve) => {
      resolveSearch = resolve;
    });
    vi.mocked(searchWallhaven).mockReturnValueOnce(pendingSearch);

    const first = refreshWallpaperPool(now);
    const second = refreshWallpaperPool(now);
    resolveSearch?.({ ok: true, items: [candidate("one")] });

    await expect(second).resolves.toMatchObject({ status: "REFRESHED" });
    await expect(first).resolves.toMatchObject({ status: "REFRESHED" });
    expect(searchWallhaven).toHaveBeenCalledTimes(1);
  });
});
