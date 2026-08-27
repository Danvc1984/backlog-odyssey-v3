import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRawgGame, searchRawgCandidates } from "./rawg-api";

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
  stores: [
    {
      id: 1,
      url: "https://store.steampowered.com/app/620/Portal_2/",
      store: { id: 1, name: "Steam", slug: "steam" },
    },
    {
      id: 3,
      url: "https://www.gog.com/en/game/portal_2",
      store: { id: 3, name: "GOG", slug: "gog" },
    },
    {
      id: 9,
      url: null,
      store: { id: 9, name: "Mystery", slug: null },
    },
  ],
};

describe("matchRawgGame", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAWG_API_KEY", "test-key");
  });

  it("parses the stores array from game details", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(detail), { status: 200 }),
    );

    const result = await matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock });

    expect(result).toMatchObject({
      outcome: "MATCHED",
      game: {
        stores: [
          { storeSlug: "steam", storeName: "Steam", url: "https://store.steampowered.com/app/620/Portal_2/" },
          { storeSlug: "gog", storeName: "GOG", url: "https://www.gog.com/en/game/portal_2" },
          { storeSlug: null, storeName: "Mystery", url: null },
        ],
      },
    });
  });

  it("uses title search instead of treating a Steam App ID as a RAWG ID", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ id: 456, slug: "different-title", name: "Different title" }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...detail, id: 456 }), { status: 200 }));

    await expect(
      matchRawgGame({ title: "Different title" }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", game: { id: 456 } });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/api/games");
    expect(requestUrl.searchParams.get("search")).toBe("different title");
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe("/api/games/456");
  });

  it("normalizes imported Steam titles before querying RAWG without changing exact matching", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: 123, slug: "lego-marvel-super-heroes", name: "LEGO Marvel Super Heroes" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...detail, name: "LEGO Marvel Super Heroes" }), { status: 200 }),
      );

    await expect(
      matchRawgGame({ title: "LEGO® Marvel™ Super Heroes" }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", game: { id: 123 } });

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("search")).toBe("lego marvel super heroes");
  });

  it("fetches a persisted selected RAWG ID directly", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(
      matchRawgGame(
        { title: "An inconsistent manual name", selectedRawgId: 123 },
        { fetchFn: fetchMock },
      ),
    ).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe("/api/games/123");
  });

  it("requests a later search page with the stable candidate page size", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ id: 456, slug: "portal-2-classic", name: "Portal 2 Classic" }] }),
        { status: 200 },
      ),
    );

    await expect(searchRawgCandidates("Portal 2", 2, { fetchFn: fetchMock })).resolves.toMatchObject([
      { id: 456, name: "Portal 2 Classic" },
    ]);

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(requestUrl.searchParams.get("page_size")).toBe("5");
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

  it.each([
    [
      "malformed detail",
      new Response(JSON.stringify({ id: 123 }), { status: 200 }),
      { title: "Portal 2" },
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
      { title: "Portal 2" },
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
    fetchMock.mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

    await expect(
      matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("parses the ESRB rating and series entries, skipping junk series rows", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...detail, esrb_rating: { id: 5, name: "Mature", slug: "mature" } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              { id: 1, slug: "portal", name: "Portal", released: "2007-10-09" },
              "junk",
              { id: "bad", name: "No numeric id" },
              { id: 2, name: "   " },
              { id: 3 },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(
      matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({
      outcome: "MATCHED",
      game: {
        esrbRating: { name: "Mature", slug: "mature" },
        seriesGames: [{ rawgId: 1, name: "Portal", slug: "portal", released: "2007-10-09" }],
      },
    });

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe("/api/games/123/game-series");
  });

  it.each([
    ["absent", detail],
    ["null", { ...detail, esrb_rating: null }],
    ["malformed", { ...detail, esrb_rating: { name: 42, slug: "junk" } }],
  ])("keeps the ESRB rating null and the match intact when the rating is %s", async (_label, payload) => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }));

    await expect(
      matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", game: { esrbRating: null, seriesGames: [] } });
  });

  it("caps the series list at 20 entries", async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      slug: `game-${index + 1}`,
      name: `Game ${index + 1}`,
      released: null,
    }));
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: many }), { status: 200 }));

    const result = await matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock });
    expect(result).toMatchObject({ outcome: "MATCHED" });
    expect((result as { game: { seriesGames: unknown[] } }).game.seriesGames).toHaveLength(20);
  });

  it.each([
    ["a network failure", () => Promise.reject(new Error("offline"))],
    ["a rate limit", () => Promise.resolve(new Response("rate limited", { status: 429 }))],
    [
      "a malformed payload",
      () => Promise.resolve(new Response(JSON.stringify({ results: "not-an-array" }), { status: 200 })),
    ],
  ])("keeps details usable when the series call hits %s", async (_label, seriesResponse) => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }))
      .mockImplementationOnce(seriesResponse);

    await expect(
      matchRawgGame({ title: "Portal 2", selectedRawgId: 123 }, { fetchFn: fetchMock }),
    ).resolves.toMatchObject({ outcome: "MATCHED", game: { id: 123, seriesGames: [] } });
  });
});
