import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOwnedGames, findSteamAppIdByName } from "./steam-api";

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

describe("findSteamAppIdByName", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  const searchResponse = (items: unknown[]) =>
    new Response(JSON.stringify({ total: items.length, items }), { status: 200 });

  it("returns the exact-name app match with its store URL", async () => {
    fetchMock.mockResolvedValue(
      searchResponse([
        { type: "sub", name: "Portal 2 Complete", id: 999 },
        { type: "app", name: "portal 2", id: 620 },
      ]),
    );

    await expect(findSteamAppIdByName(" Portal 2 ")).resolves.toEqual({
      steamAppId: "620",
      steamUrl: "https://store.steampowered.com/app/620",
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/storesearch/");
    expect(url.searchParams.get("term")).toBe("Portal 2");
    expect(url.searchParams.get("cc")).toBe("MX");
  });

  it("returns null when no item matches the name exactly", async () => {
    fetchMock.mockResolvedValue(
      searchResponse([{ type: "app", name: "Portal 2 Soundtrack", id: 323180 }]),
    );

    await expect(findSteamAppIdByName("Portal 2")).resolves.toBeNull();
  });

  it("ignores non-app results even with an exact name", async () => {
    fetchMock.mockResolvedValue(searchResponse([{ type: "bundle", name: "Portal 2", id: 5 }]));

    await expect(findSteamAppIdByName("Portal 2")).resolves.toBeNull();
  });

  it("returns null on HTTP failure, malformed payloads, and empty terms", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(findSteamAppIdByName("Portal 2")).resolves.toBeNull();

    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(findSteamAppIdByName("Portal 2")).resolves.toBeNull();

    await expect(findSteamAppIdByName("   ")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
