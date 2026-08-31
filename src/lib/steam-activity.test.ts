import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchRecentlyPlayedGames: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { fetchRecentlyPlayedGames } from "@/lib/steam-api";
import {
  ACTIVITY_REFRESH_INTERVAL_MS,
  ACTIVITY_UNAVAILABLE_MESSAGE,
  RECENT_ACTIVITY_MAX_ENTRIES,
  buildSteamActivityView,
  capRecentEntries,
  classifyRecentEntries,
  isActivityRefreshDue,
  readRecentEntries,
  refreshSteamActivityCacheIfStale,
  type SteamActivityEntry,
} from "./steam-activity";

type FetchResult = Awaited<ReturnType<typeof fetchRecentlyPlayedGames>>;

const steamConnectionFindUnique = vi.fn();
const cacheFindUnique = vi.fn();
const cacheUpsert = vi.fn();
const externalIdFindMany = vi.fn();

function entry(
  steamAppId: string,
  name: string,
  lastPlayedAt: string | null = null,
): SteamActivityEntry {
  return {
    steamAppId,
    name,
    lastPlayedAt,
    playtimeForeverMinutes: 10,
    playtimeTwoWeeksMinutes: 2,
  };
}

describe("isActivityRefreshDue", () => {
  it("is due when there was never an attempt and refreshes once 24 hours have passed", () => {
    const now = new Date("2025-01-10T00:00:00.000Z");
    expect(isActivityRefreshDue(null, now)).toBe(true);
    expect(isActivityRefreshDue({ lastAttemptAt: null }, now)).toBe(true);

    const recent = new Date(now.getTime() - ACTIVITY_REFRESH_INTERVAL_MS + 1);
    expect(isActivityRefreshDue({ lastAttemptAt: recent }, now)).toBe(false);

    const boundary = new Date(now.getTime() - ACTIVITY_REFRESH_INTERVAL_MS);
    expect(isActivityRefreshDue({ lastAttemptAt: boundary }, now)).toBe(true);

    const overdue = new Date(now.getTime() - ACTIVITY_REFRESH_INTERVAL_MS - 1);
    expect(isActivityRefreshDue({ lastAttemptAt: overdue }, now)).toBe(true);
  });
});

describe("capRecentEntries", () => {
  it("dedupes by app id, sorts last played desc with nulls last then name asc, and caps at 10", () => {
    const entries = [
      entry("1", "Alpha", "2025-01-03T00:00:00.000Z"),
      entry("2", "Beta", "2025-01-01T00:00:00.000Z"),
      entry("2", "Beta duplicate", "2026-01-01T00:00:00.000Z"),
      entry("3", "Gamma", "2025-01-02T00:00:00.000Z"),
      ...Array.from({ length: 10 }, (_, index) =>
        entry(String(index + 4), `Null${String(index + 1).padStart(2, "0")}`),
      ),
    ];

    const capped = capRecentEntries(entries);

    expect(capped).toHaveLength(RECENT_ACTIVITY_MAX_ENTRIES);
    expect(capped.slice(0, 3).map((item) => item.steamAppId)).toEqual(["1", "3", "2"]);
    expect(capped[0].name).toBe("Alpha");
    expect(capped.slice(3).map((item) => item.steamAppId)).toEqual(
      ["4", "5", "6", "7", "8", "9", "10"],
    );
  });

  it("keeps the first occurrence when app ids collide", () => {
    const capped = capRecentEntries([
      entry("1", "Original"),
      entry("1", "Duplicate"),
    ]);
    expect(capped).toEqual([entry("1", "Original")]);
  });
});

describe("classifyRecentEntries", () => {
  it("preserves order and splits by imported app ids", () => {
    const entries = [entry("620", "Portal 2"), entry("10", "Portal"), entry("999", "Unknown")];
    const classified = classifyRecentEntries(
      entries,
      new Set(["10", "620"]),
    );
    expect(classified.imported.map((item) => item.steamAppId)).toEqual(["620", "10"]);
    expect(classified.unimported.map((item) => item.steamAppId)).toEqual(["999"]);
  });
});

describe("readRecentEntries", () => {
  it("reads a valid stored array and tolerates unparseable or malformed JSON", () => {
    const stored = [entry("620", "Portal 2", "2025-01-01T00:00:00.000Z")];
    expect(readRecentEntries(stored)).toEqual(stored);

    expect(readRecentEntries("not-an-array")).toEqual([]);
    expect(readRecentEntries(null)).toEqual([]);
    expect(readRecentEntries({ steamAppId: "620" })).toEqual([]);

    const mixed = [entry("10", "Portal"), { steamAppId: "bad" }, "garbage"];
    expect(readRecentEntries(mixed)).toEqual([entry("10", "Portal")]);
  });
});

describe("buildSteamActivityView", () => {
  it("returns the NO_CONNECTION view for a missing cache row", () => {
    expect(buildSteamActivityView(null, new Set())).toEqual({
      state: "NO_CONNECTION",
      imported: [],
      unimported: [],
      checkedAt: null,
      errorMessage: null,
    });
  });

  it("returns FRESH with classified entries", () => {
    const refreshedAt = new Date("2025-01-02T00:00:00.000Z");
    const view = buildSteamActivityView(
      {
        entries: [entry("620", "Portal 2", "2025-01-01T00:00:00.000Z"), entry("999", "Unknown")],
        refreshedAt,
        lastAttemptAt: refreshedAt,
        lastError: null,
      },
      new Set(["620"]),
    );
    expect(view.state).toBe("FRESH");
    expect(view.imported.map((item) => item.steamAppId)).toEqual(["620"]);
    expect(view.unimported.map((item) => item.steamAppId)).toEqual(["999"]);
    expect(view.checkedAt).toBe(refreshedAt);
    expect(view.errorMessage).toBeNull();
  });

  it("returns FRESH_EMPTY without entries and no error", () => {
    const refreshedAt = new Date("2025-01-02T00:00:00.000Z");
    const view = buildSteamActivityView(
      { entries: [], refreshedAt, lastAttemptAt: refreshedAt, lastError: null },
      new Set(),
    );
    expect(view.state).toBe("FRESH_EMPTY");
    expect(view.imported).toEqual([]);
    expect(view.unimported).toEqual([]);
  });

  it("returns STALE_ERROR retaining entries when the last attempt failed", () => {
    const refreshedAt = new Date("2025-01-01T00:00:00.000Z");
    const view = buildSteamActivityView(
      {
        entries: [entry("620", "Portal 2", "2025-01-01T00:00:00.000Z")],
        refreshedAt,
        lastAttemptAt: new Date("2025-01-02T00:00:00.000Z"),
        lastError: ACTIVITY_UNAVAILABLE_MESSAGE,
      },
      new Set(),
    );
    expect(view.state).toBe("STALE_ERROR");
    expect(view.errorMessage).toBe(ACTIVITY_UNAVAILABLE_MESSAGE);
    expect(view.imported).toEqual([]);
    expect(view.unimported.map((item) => item.steamAppId)).toEqual(["620"]);
    expect(view.checkedAt).toBe(refreshedAt);
  });
});

describe("refreshSteamActivityCacheIfStale", () => {
  const now = new Date("2025-01-10T00:00:00.000Z");
  let connectionValue: { id: number; steamId64: string } | null;
  let cacheRowValue: {
    entries: unknown;
    refreshedAt: Date | null;
    lastAttemptAt: Date | null;
    lastError: string | null;
  } | null;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEAM_WEB_API_KEY = "test-key";
    connectionValue = { id: 1, steamId64: "76561198000000000" };
    cacheRowValue = null;
    externalIdFindMany.mockResolvedValue([]);
    steamConnectionFindUnique.mockImplementation(async () => connectionValue);
    cacheFindUnique.mockImplementation(async () => cacheRowValue);
    cacheUpsert.mockImplementation(async ({ create, update }) => {
      cacheRowValue = { ...(cacheRowValue ?? create), ...update };
      return cacheRowValue;
    });
    Object.assign(prisma, {
      steamConnection: { findUnique: steamConnectionFindUnique },
      steamRecentActivityCache: { findUnique: cacheFindUnique, upsert: cacheUpsert },
      externalGameId: { findMany: externalIdFindMany },
    });
  });

  it("returns the NO_CONNECTION view and writes nothing without a Steam connection", async () => {
    connectionValue = null;

    const view = await refreshSteamActivityCacheIfStale(now);

    expect(view.state).toBe("NO_CONNECTION");
    expect(cacheFindUnique).not.toHaveBeenCalled();
    expect(cacheUpsert).not.toHaveBeenCalled();
    expect(fetchRecentlyPlayedGames).not.toHaveBeenCalled();
  });

  it("returns the NO_CONNECTION view and writes nothing without an API key", async () => {
    delete process.env.STEAM_WEB_API_KEY;

    const view = await refreshSteamActivityCacheIfStale(now);

    expect(view.state).toBe("NO_CONNECTION");
    expect(cacheFindUnique).not.toHaveBeenCalled();
    expect(cacheUpsert).not.toHaveBeenCalled();
    expect(fetchRecentlyPlayedGames).not.toHaveBeenCalled();
  });

  it("claims the attempt before fetching and never double-fires the provider call", async () => {
    let resolveFetch: (value: FetchResult) => void = () => {};
    const fetchPromise = new Promise<FetchResult>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetchRecentlyPlayedGames).mockReturnValue(fetchPromise);

    const first = refreshSteamActivityCacheIfStale(now);
    await vi.waitFor(() => {
      expect(cacheUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          update: { lastAttemptAt: now },
        }),
      );
    });
    expect(fetchRecentlyPlayedGames).toHaveBeenCalledTimes(1);

    const second = refreshSteamActivityCacheIfStale(now);
    resolveFetch({ status: "OK", games: [entry("620", "Portal 2", "2025-01-09T00:00:00.000Z")] });
    const [firstView, secondView] = await Promise.all([first, second]);

    expect(fetchRecentlyPlayedGames).toHaveBeenCalledTimes(1);
    expect(firstView.state).toBe("FRESH");
    expect(secondView.state).toBe("FRESH");
  });

  it("stores capped entries, clears a previous error, and classifies imported titles", async () => {
    vi.mocked(fetchRecentlyPlayedGames).mockResolvedValue({
      status: "OK",
      games: [
        entry("620", "Portal 2", "2025-01-09T00:00:00.000Z"),
        entry("999", "Not imported", "2025-01-08T00:00:00.000Z"),
      ],
    });
    externalIdFindMany.mockResolvedValue([{ externalId: "620" }]);

    const view = await refreshSteamActivityCacheIfStale(now);

    expect(cacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          entries: [entry("620", "Portal 2", "2025-01-09T00:00:00.000Z"), entry("999", "Not imported", "2025-01-08T00:00:00.000Z")],
          refreshedAt: now,
          lastError: null,
        },
      }),
    );
    expect(externalIdFindMany).toHaveBeenCalledWith({
      where: { namespace: "STEAM_APP", externalId: { in: ["620", "999"] } },
      select: { externalId: true },
    });
    expect(view.state).toBe("FRESH");
    expect(view.imported.map((item) => item.steamAppId)).toEqual(["620"]);
    expect(view.unimported.map((item) => item.steamAppId)).toEqual(["999"]);
    expect(view.checkedAt).toEqual(now);
  });

  it("retains previous entries and records the safe error when the fetch is unavailable", async () => {
    const oldRefreshed = new Date("2025-01-01T00:00:00.000Z");
    const previous = entry("620", "Portal 2", "2024-12-31T00:00:00.000Z");
    cacheRowValue = {
      entries: [previous],
      refreshedAt: oldRefreshed,
      lastAttemptAt: new Date(now.getTime() - ACTIVITY_REFRESH_INTERVAL_MS - 1000),
      lastError: null,
    };
    vi.mocked(fetchRecentlyPlayedGames).mockResolvedValue({ status: "UNAVAILABLE" });

    const view = await refreshSteamActivityCacheIfStale(now);

    expect(cacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ lastAttemptAt: now, lastError: ACTIVITY_UNAVAILABLE_MESSAGE }),
        update: { lastError: ACTIVITY_UNAVAILABLE_MESSAGE },
      }),
    );
    expect(view.state).toBe("STALE_ERROR");
    expect(view.errorMessage).toBe(ACTIVITY_UNAVAILABLE_MESSAGE);
    expect(view.unimported.map((item) => item.steamAppId)).toEqual(["620"]);
    expect(view.checkedAt).toBe(oldRefreshed);
  });

  it("skips the refresh when not due and serves the cached view", async () => {
    const refreshedAt = new Date("2025-01-09T00:00:00.000Z");
    cacheRowValue = {
      entries: [entry("620", "Portal 2", "2025-01-08T00:00:00.000Z")],
      refreshedAt,
      lastAttemptAt: new Date(now.getTime() - 60 * 60 * 1000),
      lastError: null,
    };

    const view = await refreshSteamActivityCacheIfStale(now);

    expect(fetchRecentlyPlayedGames).not.toHaveBeenCalled();
    expect(cacheUpsert).not.toHaveBeenCalled();
    expect(view.state).toBe("FRESH");
    expect(view.unimported.map((item) => item.steamAppId)).toEqual(["620"]);
    expect(view.checkedAt).toBe(refreshedAt);
  });
});