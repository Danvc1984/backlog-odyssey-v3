import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOwnedGames } from "./steam-api";

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
