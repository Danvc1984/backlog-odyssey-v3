import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getToken, invalidate } = vi.hoisted(() => ({
  getToken: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("./igdb-token", () => ({
  getIgdbAccessToken: getToken,
  getIgdbConfig: () => ({ ok: true, config: { clientId: "client-id", clientSecret: "secret" } }),
  invalidateIgdbToken: invalidate,
}));
vi.mock("./igdb-rate-limit", () => ({
  withIgdbRateLimit: (operation: () => Promise<Response>) => operation(),
}));

import {
  classifyIgdbCategory,
  fetchIgdbGameTimeToBeats,
  matchIgdbGame,
  requestIgdb,
  searchIgdbCandidatePage,
  searchIgdbCandidates,
} from "./igdb-api";

describe("IGDB request boundary", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getToken.mockResolvedValue({ ok: true, token: "access-token" });
  });

  it("sends an authenticated APICalypse POST", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));

    await expect(requestIgdb("fields id;", { fetchFn: fetchMock })).resolves.toEqual({
      ok: true,
      data: [{ id: 1 }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.igdb.com/v4/games",
      expect.objectContaining({
        method: "POST",
        body: "fields id;",
        headers: {
          "Client-ID": "client-id",
          Authorization: "Bearer access-token",
          "Content-Type": "text/plain",
        },
      }),
    );
  });

  it("honors Retry-After on a 429 before retrying", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const delays: number[] = [];

    await expect(
      requestIgdb("fields id;", {
        fetchFn: fetchMock,
        delayFn: async (milliseconds) => { delays.push(milliseconds); },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(delays).toEqual([3_000]);
  });

  it("refreshes authentication exactly once after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    getToken
      .mockResolvedValueOnce({ ok: true, token: "expired-token" })
      .mockResolvedValueOnce({ ok: true, token: "fresh-token" });

    await expect(requestIgdb("fields id;", { fetchFn: fetchMock })).resolves.toMatchObject({ ok: true });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    }));
  });

  it("maps a timeout to NETWORK without retrying when limited to one attempt", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "AbortError"));

    await expect(requestIgdb("fields id;", { fetchFn: fetchMock, maxAttempts: 1 })).resolves.toEqual({
      ok: false,
      error: { category: "NETWORK", message: "IGDB could not be reached" },
    });
  });

  it("keeps the abort timer active until the fetch settles", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let resolveFetch: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((_input: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((resolve) => { resolveFetch = resolve; });
    });

    const resultPromise = requestIgdb("fields id;", { fetchFn: fetchMock, maxAttempts: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(signal?.aborted).toBe(true);
    resolveFetch?.(new Response("[]", { status: 200 }));
    await expect(resultPromise).resolves.toEqual({ ok: true, data: [] });
    vi.useRealTimers();
  });

  it("does not retry other client errors", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

    await expect(requestIgdb("fields id;", { fetchFn: fetchMock })).resolves.toEqual({
      ok: false,
      error: { category: "HTTP", message: "IGDB rejected the request", status: 403 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("pins the documented category classes", () => {
    expect(classifyIgdbCategory({ category: 0, game_type: null })).toBe("MAIN_GAME");
    expect(classifyIgdbCategory({ category: 1, game_type: null })).toBe("DLC");
    expect(classifyIgdbCategory({ category: 3, game_type: null })).toBe("NEVER_AUTO");
    expect(classifyIgdbCategory({ category: 99, game_type: null })).toBe("NEVER_AUTO");
  });

  it("resolves Steam App IDs before title search", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ game: 42 }, { game: 42 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 42, name: "Portal 2", game_type: 0 }]), { status: 200 }));

    await expect(matchIgdbGame({ title: "Wrong title", category: "MAIN_GAME", steamAppId: "620" }, { fetchFn: fetchMock })).resolves.toMatchObject({
      outcome: "MATCHED",
      matchMethod: "EXACT_STEAM_APP_ID",
      game: { id: 42 },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.igdb.com/v4/external_games");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("auto-fixes exact and high-confidence fuzzy title matches", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 10, name: "Portal 2", category: 0, alternative_names: [] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 10, name: "Portal 2", category: 0 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 11, name: "The Witcher 3 Wild Hunt Remastered", category: 0, alternative_names: [] }, { id: 12, name: "Unrelated", category: 0 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 11, name: "The Witcher 3 Wild Hunt Remastered", category: 0 }]), { status: 200 }));

    await expect(matchIgdbGame({ title: "Portal 2", category: "MAIN_GAME" }, { fetchFn: fetchMock })).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "INFERRED", game: { id: 10 } });
    await expect(matchIgdbGame({ title: "The Witcher 3 Wild Hunt", category: "MAIN_GAME" }, { fetchFn: fetchMock })).resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "INFERRED", game: { id: 11 } });
  });

  it("validates a title match with missing search category from the full game", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 42, name: "Portal 2", category: null, alternative_names: [] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 42, name: "Portal 2", game_type: 0 }]), { status: 200 }));

    await expect(matchIgdbGame({ title: "Portal 2", category: "MAIN_GAME" }, { fetchFn: fetchMock }))
      .resolves.toMatchObject({ outcome: "MATCHED", matchMethod: "INFERRED", game: { id: 42 } });
  });

  it("refuses incompatible automatic categories and reports ranked candidates", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 20, name: "Portal 2 DLC", category: 1, alternative_names: [] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 21, name: "Portal 2", category: 0, alternative_names: [] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 22, name: "Portal Bundle", category: 3, alternative_names: [] }]), { status: 200 }));

    await expect(matchIgdbGame({ title: "Portal 2 DLC", category: "MAIN_GAME" }, { fetchFn: fetchMock })).resolves.toMatchObject({ outcome: "AMBIGUOUS" });
    await expect(matchIgdbGame({ title: "Portal 2", category: "DLC" }, { fetchFn: fetchMock })).resolves.toMatchObject({ outcome: "AMBIGUOUS" });
    await expect(matchIgdbGame({ title: "Portal Bundle", category: "MAIN_GAME" }, { fetchFn: fetchMock })).resolves.toMatchObject({ outcome: "AMBIGUOUS" });
  });

  it("allows manual selection with a class-mismatch flag", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: 30, name: "Portal DLC", category: 1 }]), { status: 200 }));

    await expect(matchIgdbGame({ title: "Portal", category: "MAIN_GAME", selectedIgdbId: 30 }, { fetchFn: fetchMock })).resolves.toMatchObject({
      outcome: "MATCHED",
      matchMethod: "MANUAL_IGDB_SEARCH",
      classMismatch: true,
    });
  });

  it("distinguishes not-found and unavailable outcomes", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));

    await expect(matchIgdbGame({ title: "Missing", category: "MAIN_GAME" }, { fetchFn: fetchMock })).resolves.toEqual({ outcome: "NOT_FOUND" });
    await expect(matchIgdbGame({ title: "Unavailable", category: "MAIN_GAME" }, { fetchFn: fetchMock, maxAttempts: 1 })).resolves.toMatchObject({ outcome: "UNAVAILABLE", error: { category: "HTTP" } });
  });

  it("threads an offset into paged candidate searches", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await expect(searchIgdbCandidates("Portal 2", { fetchFn: fetchMock, offset: 10 }))
      .resolves.toEqual({ ok: true, data: [] });
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      body: expect.stringContaining("limit 30; offset 10;"),
    }));
  });

  it("parses game time to beats values and treats non-positive values as absent", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{
      count: 12,
      hastily: 3_600,
      normally: 7_200,
      completely: 0,
    }]), { status: 200 }));

    await expect(fetchIgdbGameTimeToBeats(42, { fetchFn: fetchMock })).resolves.toEqual({
      ok: true,
      data: { count: 12, hastilySeconds: 3_600, normallySeconds: 7_200, completelySeconds: null },
    });
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ body: expect.stringContaining("game_id = 42") }));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.igdb.com/v4/game_time_to_beats");
  });

  it("returns null when game time to beats has no row", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    await expect(fetchIgdbGameTimeToBeats(42, { fetchFn: fetchMock })).resolves.toEqual({ ok: true, data: null });
  });

  it("ranks title-prefix candidates ahead of less-specific matches", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([
      { id: 1, name: "Event Horizon", alternative_names: [] },
      { id: 2, name: "Horizon Forbidden West", alternative_names: [] },
      { id: 3, name: "Horizon Zero Dawn", alternative_names: [] },
    ]), { status: 200 }));

    await expect(searchIgdbCandidatePage("horizon", { fetchFn: fetchMock }))
      .resolves.toMatchObject({ data: [
        { id: 3, name: "Horizon Zero Dawn" },
        { id: 2, name: "Horizon Forbidden West" },
        { id: 1, name: "Event Horizon" },
      ] });
  });

  it("uses a typo-tolerant anchor for the initial candidate search", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await searchIgdbCandidates("Horizon zedro daw", { fetchFn: fetchMock });

    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      body: expect.stringContaining('search "Horizon";'),
    }));
  });
});
