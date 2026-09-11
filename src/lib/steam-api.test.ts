import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOwnedGames,
  fetchRecentlyPlayedGames,
  fetchSteamStorePrices,
  fetchSteamWishlist,
} from "./steam-api";

describe("fetchOwnedGames", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses owned games and sends the required Steam API parameters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            game_count: 1,
            games: [
              {
                appid: 10,
                name: "Portal",
                playtime_forever: 120,
                rtime_last_played: 1700000000,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchOwnedGames("76561198000000000", "test-key"),
    ).resolves.toEqual([
      {
        appid: 10,
        name: "Portal",
        playtimeForever: 120,
        rtimeLastPlayed: 1700000000,
      },
    ]);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
      key: "test-key",
      steamid: "76561198000000000",
      include_appinfo: "1",
      format: "json",
    });
    expect(options).toEqual({ cache: "no-store" });
  });

  it("returns an empty list when Steam has no games", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: {} }), { status: 200 }),
    );

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual(
      [],
    );
  });

  it("returns an empty list when Steam responds with an error", async () => {
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual(
      [],
    );
  });

  it("classifies Steam DLC and records its full-game app id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              games: [{ appid: 200, name: "Expansion", playtime_forever: 0 }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "200": { success: true, data: { type: "dlc", fullgame: { appid: 100 } } },
          }),
          { status: 200 },
        ),
      );

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual([
      expect.objectContaining({ type: "DLC", steamBaseAppId: "100" }),
    ]);
  });

  it("accepts Steam's string-form DLC parent app id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              games: [{ appid: 200, name: "Expansion", playtime_forever: 0 }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "200": { success: true, data: { type: "dlc", fullgame: { appid: "100" } } },
          }),
          { status: 200 },
        ),
      );

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual([
      expect.objectContaining({ type: "DLC", steamBaseAppId: "100" }),
    ]);
  });

  it("bounds concurrent store appdetails lookups for large libraries", async () => {
    const games = Array.from({ length: 40 }, (_, index) => ({
      appid: index + 1,
      name: `Game ${index + 1}`,
      playtime_forever: 0,
    }));
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async (url: string | URL) => {
      if (String(url).includes("GetOwnedGames")) {
        return new Response(JSON.stringify({ response: { games } }), { status: 200 });
      }
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const appid = new URL(String(url)).searchParams.get("appids");
      inFlight -= 1;
      return new Response(
        JSON.stringify({ [appid ?? ""]: { success: true, data: { type: "game" } } }),
        { status: 200 },
      );
    });

    const result = await fetchOwnedGames("steam-id", "test-key");

    expect(result).toHaveLength(40);
    expect(peak).toBeLessThanOrEqual(8);
    expect(fetchMock).toHaveBeenCalledTimes(41);
  });

  it("returns an empty list for malformed payloads and ignores malformed games", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            games: [
              { appid: 10, name: "Portal" },
              { appid: "not-a-number", name: "Invalid" },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual([
      {
        appid: 10,
        name: "Portal",
        playtimeForever: 0,
        rtimeLastPlayed: 0,
      },
    ]);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: { games: "invalid" } }), {
        status: 200,
      }),
    );

    await expect(fetchOwnedGames("steam-id", "test-key")).resolves.toEqual(
      [],
    );
  });
});

describe("fetchSteamWishlist", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("fetches wishlist app IDs and enriches names and DLC details", async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.includes("GetWishlist")) {
        return new Response(JSON.stringify({ response: { items: [{ appid: 10 }, { appid: 51 }] } }), { status: 200 });
      }
      if (parsedUrl.pathname.includes("GetAppList")) {
        const input = JSON.parse(parsedUrl.searchParams.get("input_json") ?? "{}");
        const apps = input.include_games
          ? [{ appid: 10, name: "Portal" }]
          : [{ appid: 51, name: "Expansion" }];
        return new Response(JSON.stringify({ response: { apps, have_more_results: false, last_appid: apps[0].appid } }), { status: 200 });
      }
      return new Response(JSON.stringify({ "51": { success: true, data: { name: "Expansion", type: "dlc", fullgame: { appid: "10" } } } }), { status: 200 });
    });

    await expect(fetchSteamWishlist("76561198000000000", "test-key")).resolves.toEqual({
      games: [
        { appid: 10, name: "Portal" },
        { appid: 51, name: "Expansion", type: "DLC", steamBaseAppId: "10" },
      ],
      status: "OK",
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/IWishlistService/GetWishlist/v1/");
    expect(url.searchParams.get("steamid")).toBe("76561198000000000");
    expect(url.searchParams.get("key")).toBe("test-key");
    const appListUrl = new URL(
      fetchMock.mock.calls.find(([input]) => String(input).includes("GetAppList"))?.[0] as string,
    );
    expect(JSON.parse(appListUrl.searchParams.get("input_json") ?? "{}")).toMatchObject({
      include_games: true,
      include_dlc: false,
      include_software: true,
      max_results: 50_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("uses app-list names and keeps DLCs when optional detail lookup fails", async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.includes("GetWishlist")) {
        return new Response(JSON.stringify({ response: { items: [{ appid: 10 }, { appid: 51 }, { appid: 99 }] } }), { status: 200 });
      }
      if (parsedUrl.pathname.includes("GetAppList")) {
        const input = JSON.parse(parsedUrl.searchParams.get("input_json") ?? "{}");
        const apps = input.include_games
          ? [{ appid: 10, name: "Portal" }, { appid: 99, name: "Another Game" }]
          : [{ appid: 51, name: "Expansion" }];
        return new Response(JSON.stringify({ response: { apps, have_more_results: false, last_appid: 99 } }), { status: 200 });
      }
      return new Response("rate limited", { status: 403 });
    });

    await expect(fetchSteamWishlist("steam-id", "test-key")).resolves.toEqual({
      games: [
        { appid: 10, name: "Portal" },
        { appid: 51, name: "Expansion", type: "DLC" },
        { appid: 99, name: "Another Game" },
      ],
      status: "OK",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("follows app-list pagination only until the largest requested app ID", async () => {
    let gameListCalls = 0;
    fetchMock.mockImplementation(async (url: string | URL) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.includes("GetWishlist")) {
        return new Response(JSON.stringify({ response: { items: [{ appid: 10 }, { appid: 30 }] } }), { status: 200 });
      }
      if (parsedUrl.pathname.includes("GetAppList")) {
        const input = JSON.parse(parsedUrl.searchParams.get("input_json") ?? "{}");
        if (!input.include_games) {
          return new Response(JSON.stringify({ response: { apps: [], have_more_results: false } }), { status: 200 });
        }
        gameListCalls += 1;
        const apps = gameListCalls === 1
          ? [{ appid: 10, name: "Portal" }]
          : [{ appid: 30, name: "Portal 2" }];
        return new Response(JSON.stringify({ response: { apps, have_more_results: gameListCalls === 1, last_appid: apps[0].appid } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await expect(fetchSteamWishlist("steam-id", "test-key")).resolves.toMatchObject({
      games: [
        { appid: 10, name: "Portal" },
        { appid: 30, name: "Portal 2" },
      ],
      status: "OK",
    });
    expect(gameListCalls).toBe(2);
  });

  it("returns an empty list for an empty wishlist", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: { items: [] } }), { status: 200 }),
    );

    await expect(fetchSteamWishlist("steam-id", "test-key")).resolves.toEqual({ games: [], status: "EMPTY" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when Steam responds with an HTTP error", async () => {
    fetchMock.mockResolvedValue(new Response("private", { status: 403 }));

    await expect(fetchSteamWishlist("steam-id", "test-key")).resolves.toEqual({ games: [], status: "UNAVAILABLE" });
  });

  it("returns an empty list for malformed wishlist JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(fetchSteamWishlist("steam-id", "test-key")).resolves.toEqual({ games: [], status: "UNAVAILABLE" });
  });
});

describe("fetchSteamStorePrices", () => {
  it("returns Mexican Steam Store prices and discounts in major currency units", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          "620": {
            success: true,
            data: {
              price_overview: {
                currency: "MXN",
                initial: 24900,
                final: 12450,
                discount_percent: 50,
              },
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(fetchSteamStorePrices(["620"], fetchMock)).resolves.toEqual(
      new Map([[
        "620",
        {
          appid: 620,
          currency: "MXN",
          regularPrice: 249,
          price: 124.5,
          discount: 50,
          url: "https://store.steampowered.com/app/620/?cc=mx",
        },
      ]]),
    );

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("cc")).toBe("MX");
    expect(requestUrl.searchParams.get("filters")).toBe("price_overview");
  });
});

describe("fetchRecentlyPlayedGames", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses the full recent-activity entry shape and sends the Steam API parameters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            total_count: 1,
            games: [
              {
                appid: 620,
                name: "Portal 2",
                playtime_2weeks: 95,
                playtime_forever: 1240,
                rtime_last_played: 1700000000,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchRecentlyPlayedGames("76561198000000000", "test-key"),
    ).resolves.toEqual({
      status: "OK",
      games: [
        {
          steamAppId: "620",
          name: "Portal 2",
          lastPlayedAt: new Date(1700000000 * 1000).toISOString(),
          playtimeForeverMinutes: 1240,
          playtimeTwoWeeksMinutes: 95,
        },
      ],
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/IPlayerService/GetRecentlyPlayedGames/v0001/");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("steamid")).toBe("76561198000000000");
    expect(fetchMock.mock.calls[0][1]).toEqual({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("tolerates missing playtime_2weeks and rtime_last_played", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            games: [{ appid: 10, name: "Portal", playtime_forever: 30 }],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "OK",
      games: [
        {
          steamAppId: "10",
          name: "Portal",
          lastPlayedAt: null,
          playtimeForeverMinutes: 30,
          playtimeTwoWeeksMinutes: null,
        },
      ],
    });
  });

  it("skips malformed entries and keeps valid ones", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            games: [
              { appid: "not-a-number", name: "Invalid appid" },
              { appid: 11, name: "   " },
              null,
              { appid: 12, name: "Valid" },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "OK",
      games: [
        {
          steamAppId: "12",
          name: "Valid",
          lastPlayedAt: null,
          playtimeForeverMinutes: 0,
          playtimeTwoWeeksMinutes: null,
        },
      ],
    });
  });

  it("treats a private profile or missing games array as OK with an empty list", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: {} }), { status: 200 }),
    );
    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "OK",
      games: [],
    });

    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "OK",
      games: [],
    });
  });

  it("returns UNAVAILABLE on a non-OK HTTP status", async () => {
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "UNAVAILABLE",
    });
  });

  it("returns UNAVAILABLE for malformed JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(fetchRecentlyPlayedGames("steam-id", "test-key")).resolves.toEqual({
      status: "UNAVAILABLE",
    });
  });
});
