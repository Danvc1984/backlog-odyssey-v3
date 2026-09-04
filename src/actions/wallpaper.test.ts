import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { WALLPAPER_QUERY_VERSION } from "@/lib/wallpaper";
import { shuffleWallpaper, setWallpaperEnabled } from "./wallpaper";

const pool = {
  queryVersion: WALLPAPER_QUERY_VERSION,
  fetchedAt: "2026-09-03T12:00:00.000Z",
  searched: [{ gameId: "game-1", name: "Portal 2" }],
  items: [
    {
      id: "wall-1",
      pageUrl: "https://wallhaven.cc/w/wall-1",
      imageUrl: "https://images.example.test/wall-1.jpg",
      width: 1920,
      height: 1080,
      fileType: "jpg" as const,
      uploader: null,
    },
    {
      id: "wall-2",
      pageUrl: "https://wallhaven.cc/w/wall-2",
      imageUrl: "https://images.example.test/wall-2.jpg",
      width: 2560,
      height: 1440,
      fileType: "jpg" as const,
      uploader: "artist",
    },
    {
      id: "wall-3",
      pageUrl: "https://wallhaven.cc/w/wall-3",
      imageUrl: "https://images.example.test/wall-3.png",
      width: 3840,
      height: 2160,
      fileType: "png" as const,
      uploader: null,
    },
  ],
};

describe("wallpaper actions", () => {
  const findState = vi.fn();
  const updateState = vi.fn();
  const findSettings = vi.fn();
  const upsertSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    Object.assign(prisma, {
      wallpaperState: { findUnique: findState, update: updateState },
      appSettings: { findUnique: findSettings, upsert: upsertSettings },
    });
    findState.mockResolvedValue({
      id: 1,
      candidates: pool,
      selectedIdx: 0,
      renderTarget: { day: "2026-09-03", source: "shuffle" },
      cachedAt: new Date("2026-09-03T12:00:00.000Z"),
      lastAttemptAt: null,
      lastError: null,
      updatedAt: new Date("2026-09-03T12:00:00.000Z"),
    });
    findSettings.mockResolvedValue({ timeZone: "America/Mexico_City" });
    updateState.mockResolvedValue({});
    upsertSettings.mockResolvedValue({ id: 1, wallpaperEnabled: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T18:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists a different current-day shuffle and returns its selection", async () => {
    const result = await shuffleWallpaper();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.selection.source).toBe("shuffle");
    expect(result.data.selection.index).not.toBe(0);
    expect(updateState).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        selectedIdx: result.data.selection.index,
        renderTarget: {
          day: "2026-09-03",
          source: "shuffle",
        },
      },
    });
  });

  it("returns a graceful error without a usable pool", async () => {
    findState.mockResolvedValue({ id: 1, candidates: null });

    const result = await shuffleWallpaper();

    expect(result).toMatchObject({ success: false, data: null, error: "No wallpaper pool is available" });
    expect(updateState).not.toHaveBeenCalled();
  });

  it("upserts the wallpaper enablement setting", async () => {
    const result = await setWallpaperEnabled(false);

    expect(result.success).toBe(true);
    expect(upsertSettings).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, wallpaperEnabled: false },
      update: { wallpaperEnabled: false },
    });
  });

  it("rejects non-boolean enablement input", async () => {
    const result = await setWallpaperEnabled("false" as never);

    expect(result).toMatchObject({ success: false, error: "Invalid input" });
    expect(upsertSettings).not.toHaveBeenCalled();
  });
});
