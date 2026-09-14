import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/igdb-api", () => ({ requestIgdb: vi.fn() }));

import { requestIgdb } from "@/lib/igdb-api";
import { fetchSteamDlcList } from "@/lib/steam-dlc-list";

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
}

describe("fetchSteamDlcList", () => {
  const fetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves DLC names from one IGDB batch", async () => {
    fetchFn.mockResolvedValueOnce(jsonResponse({ "10": { data: { dlc: [101, 102] } } }));
    vi.mocked(requestIgdb)
      .mockResolvedValueOnce({ ok: true, data: [{ uid: "101", game: 501 }, { uid: "102", game: 502 }] })
      .mockResolvedValueOnce({ ok: true, data: [{ id: 501, name: "First Expansion" }, { id: 502, name: "Second Expansion" }] });

    await expect(fetchSteamDlcList("10", fetchFn)).resolves.toEqual({
      status: "OK",
      candidates: [
        { steamAppId: "101", name: "First Expansion", resolvedVia: "IGDB", igdbId: 501 },
        { steamAppId: "102", name: "Second Expansion", resolvedVia: "IGDB", igdbId: 502 },
      ],
    });
    expect(requestIgdb).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to Steam names and then the raw App ID", async () => {
    fetchFn
      .mockResolvedValueOnce(jsonResponse({ "10": { data: { dlc: [101, 102] } } }))
      .mockResolvedValueOnce(jsonResponse({ "101": { data: { name: "Steam Expansion" } } }))
      .mockResolvedValueOnce(jsonResponse({ "102": { data: {} } }));
    vi.mocked(requestIgdb).mockResolvedValue({
      ok: false,
      error: { category: "NETWORK", message: "offline" },
    });

    await expect(fetchSteamDlcList("10", fetchFn)).resolves.toEqual({
      status: "OK",
      candidates: [
        { steamAppId: "101", name: "Steam Expansion", resolvedVia: "STEAM", igdbId: null },
        { steamAppId: "102", name: "102", resolvedVia: "APP_ID", igdbId: null },
      ],
    });
  });

  it("treats missing or malformed DLC data as an empty list", async () => {
    fetchFn.mockResolvedValueOnce(jsonResponse({ "10": { data: { dlc: "not-an-array" } } }));
    await expect(fetchSteamDlcList("10", fetchFn)).resolves.toEqual({ status: "EMPTY", candidates: [] });

    fetchFn.mockResolvedValueOnce(jsonResponse({ "10": { success: false } }));
    await expect(fetchSteamDlcList("10", fetchFn)).resolves.toEqual({ status: "EMPTY", candidates: [] });
  });
});
