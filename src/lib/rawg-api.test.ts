import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRawgGame } from "./rawg-api";

vi.mock("server-only", () => ({}));

const detail = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  description_raw: "A puzzle game",
  released: "2011-04-18",
  background_image: "https://media.rawg.io/portal-2.jpg",
  background_image_additional: null,
  genres: [{ id: 1, name: "Puzzle", slug: "puzzle" }],
  tags: [{ id: 2, name: "Singleplayer", slug: "singleplayer" }],
  developers: [{ id: 3, name: "Valve", slug: "valve" }],
  publishers: [{ id: 4, name: "Valve", slug: "valve" }],
  website: "https://www.thinkwithportals.com/",
  rating: 4.4,
  metacritic: 95,
  playtime: 9,
  alternative_names: [{ name: "Portal 2" }],
  updated: "2026-08-19T00:00:00Z",
};

describe("matchRawgGame", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAWG_API_KEY", "test-key");
  });

  it("prefers an exact Steam App ID match over title search", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(
      matchRawgGame({ title: "A different title", steamAppId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "EXACT_STEAM_APP_ID" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/api/games/123");
    expect(requestUrl.searchParams.get("key")).toBe("test-key");
  });

  it("returns an ambiguous result instead of guessing among title matches", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { id: 123, slug: "portal-2", name: "Portal 2" },
            { id: 456, slug: "portal-2-classic", name: "Portal 2" },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      matchRawgGame({ title: "Portal 2" }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "AMBIGUOUS", candidates: [{ id: 123 }, { id: 456 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns not found when title search has no safe match", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: 123, slug: "other", name: "Other game" }] }), {
        status: 200,
      }),
    );

    await expect(matchRawgGame({ title: "Portal 2" }, { fetchFn: fetchMock })).resolves.toEqual({
      outcome: "NOT_FOUND",
    });
  });

  it("resolves one exact title candidate after search", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ id: 123, slug: "portal-2", name: "Portal 2" }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(matchRawgGame({ title: "portal 2" }, { fetchFn: fetchMock })).resolves.toMatchObject({
      outcome: "MATCHED",
      matchMethod: "MANUAL_RAWG_SEARCH",
      game: { id: 123, name: "Portal 2" },
    });
  });

  it("falls back to title search when the exact App ID is absent", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ id: 123, slug: "portal-2", name: "Portal 2" }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(
      matchRawgGame({ title: "Portal 2", steamAppId: 999 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    [
      "malformed detail",
      new Response(JSON.stringify({ id: 123 }), { status: 200 }),
      { title: "Portal 2", steamAppId: 123 },
      "MALFORMED_RESPONSE",
    ],
    [
      "malformed search",
      new Response(JSON.stringify({ results: "not-an-array" }), { status: 200 }),
      { title: "Portal 2" },
      "MALFORMED_RESPONSE",
    ],
    [
      "provider failure",
      new Response("unavailable", { status: 503 }),
      { title: "Portal 2", steamAppId: 123 },
      "HTTP",
    ],
  ])("returns a safe provider failure for %s", async (_label, response, request, category) => {
    fetchMock.mockResolvedValue(response);

    const result = await matchRawgGame(request, { fetchFn: fetchMock });
    expect(result).toMatchObject({ outcome: "UNAVAILABLE", error: { category } });
  });

  it("does not make a request without a server-side API key", async () => {
    vi.stubEnv("RAWG_API_KEY", "");

    await expect(matchRawgGame({ title: "Portal 2" }, { fetchFn: fetchMock })).resolves.toEqual({
      outcome: "UNAVAILABLE",
      error: { category: "CONFIGURATION", message: "RAWG is not configured" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a network failure when RAWG cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(matchRawgGame({ title: "Portal 2" }, { fetchFn: fetchMock })).resolves.toMatchObject({
      outcome: "UNAVAILABLE",
      error: { category: "NETWORK" },
    });
  });

  it("allows a caller to explicitly select one title-search candidate", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              { id: 123, slug: "portal-2", name: "Portal 2" },
              { id: 456, slug: "portal-2-classic", name: "Portal 2" },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(
      matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH" });
  });
});
