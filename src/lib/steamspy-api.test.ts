import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchSteamSpyMedian } from "./steamspy-api";

describe("SteamSpy boundary", () => {
  it("parses the median playtime in minutes", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ median_forever: 840 }), { status: 200 }));

    await expect(fetchSteamSpyMedian("620", { fetchFn })).resolves.toEqual({
      ok: true,
      data: { medianForeverMinutes: 840 },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://steamspy.com/api.php?request=appdetails&appid=620",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns null for absent or non-positive medians", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ median_forever: 0 }), { status: 200 }));

    await expect(fetchSteamSpyMedian("620", { fetchFn })).resolves.toEqual({ ok: true, data: null });
  });

  it("maps HTTP, malformed, and network failures", async () => {
    await expect(fetchSteamSpyMedian("620", {
      fetchFn: vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    })).resolves.toMatchObject({ ok: false, error: { category: "HTTP", status: 503 } });
    await expect(fetchSteamSpyMedian("620", {
      fetchFn: vi.fn().mockResolvedValue(new Response("invalid", { status: 200 })),
    })).resolves.toMatchObject({ ok: false, error: { category: "MALFORMED_RESPONSE" } });
    await expect(fetchSteamSpyMedian("620", {
      fetchFn: vi.fn().mockRejectedValue(new Error("offline")),
    })).resolves.toMatchObject({ ok: false, error: { category: "NETWORK" } });
  });
});
