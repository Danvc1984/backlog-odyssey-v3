import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveDurationEstimate, resolveWishlistDurationEstimate } from "./playtime-evidence";

describe("duration resolution", () => {
  const igdb = (payload: Record<string, unknown>) => ({ provider: "IGDB" as const, payload });

  it("uses the selected IGDB profile value", () => {
    expect(resolveDurationEstimate(igdb({ count: 8, hastilySeconds: 3_600, normallySeconds: 7_200, completelySeconds: 14_400 }), "COMPLETELY"))
      .toEqual({ hours: 4, band: "SHORT", source: "IGDB_TIME_TO_BEATS", sampleCount: 8 });
  });

  it("falls back selected, normally, hastily, then completely", () => {
    expect(resolveDurationEstimate(igdb({ count: 2, hastilySeconds: 1_800, normallySeconds: null, completelySeconds: 10_800 }), "NORMALLY")?.hours).toBe(0.5);
    expect(resolveDurationEstimate(igdb({ count: 2, hastilySeconds: null, normallySeconds: null, completelySeconds: 10_800 }), "HASTILY")?.hours).toBe(3);
  });

  it("resolves SteamSpy independent of profile", () => {
    const row = { provider: "STEAMSPY" as const, payload: { appId: "620", medianForeverMinutes: 2_400 } };
    expect(resolveDurationEstimate(row, "HASTILY")).toEqual(resolveDurationEstimate(row, "COMPLETELY"));
    expect(resolveDurationEstimate(row, "NORMALLY")).toMatchObject({ hours: 40, band: "LONG", source: "STEAMSPY_MEDIAN", sampleCount: null });
  });

  it("returns null for missing rows, unknown providers, and unusable payloads", () => {
    expect(resolveDurationEstimate(null, "NORMALLY")).toBeNull();
    expect(resolveDurationEstimate({ provider: "IGDB", payload: { normallySeconds: 0 } }, "NORMALLY")).toBeNull();
    expect(resolveDurationEstimate({ provider: "UNKNOWN", payload: {} }, "NORMALLY")).toBeNull();
  });

  it("maps boundaries through the existing duration bands", () => {
    expect(resolveDurationEstimate(igdb({ hastilySeconds: 5 * 3600 }), "HASTILY")?.band).toBe("SHORT");
    expect(resolveDurationEstimate(igdb({ hastilySeconds: 6 * 3600 }), "HASTILY")?.band).toBe("MEDIUM");
    expect(resolveDurationEstimate(igdb({ hastilySeconds: 16 * 3600 }), "HASTILY")?.band).toBe("LONG");
    expect(resolveDurationEstimate(igdb({ hastilySeconds: 41 * 3600 }), "HASTILY")?.band).toBe("VERY_LONG");
  });

  it("resolves duration evidence embedded in an IGDB wishlist snapshot", () => {
    expect(resolveWishlistDurationEstimate({ durationEvidence: { provider: "IGDB", payload: { normallySeconds: 9 * 3600 } } }, "NORMALLY"))
      .toMatchObject({ hours: 9, band: "MEDIUM", source: "IGDB_TIME_TO_BEATS" });
  });

  it("resolves SteamSpy wishlist evidence and ignores malformed snapshots", () => {
    expect(resolveWishlistDurationEstimate({ durationEvidence: { provider: "STEAMSPY", payload: { medianForeverMinutes: 2_400 } } }, "HASTILY"))
      .toMatchObject({ hours: 40, band: "LONG", source: "STEAMSPY_MEDIAN" });
    expect(resolveWishlistDurationEstimate({ durationEvidence: { provider: "RAWG", payload: {} } }, "NORMALLY")).toBeNull();
    expect(resolveWishlistDurationEstimate(null, "NORMALLY")).toBeNull();
  });
});
