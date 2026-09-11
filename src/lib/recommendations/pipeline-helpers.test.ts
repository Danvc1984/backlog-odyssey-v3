import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { compatEvidenceFor, compatEvidenceForWish, tuneInput } from "./pipeline-helpers";
import { resolveCandidateDimensionValues } from "./profile";
import { matchTuneCriteria } from "./tune";

describe("compatEvidenceFor", () => {
  it("maps the personal compatibility override and reason", () => {
    expect(
      compatEvidenceFor({
        externalIds: [{ externalId: "730" }],
        availability: [{ source: "STEAM" }],
        libraryEntry: { compatOverrideStatus: "READY", compatOverrideReason: "Tested on Deck" },
        compatSnapshots: [],
      }),
    ).toMatchObject({
      overrideStatus: "READY",
      overrideReason: "Tested on Deck",
    });
  });
});

describe("compatEvidenceForWish", () => {
  const baseRow = {
    type: "BASE_GAME" as const,
    steamAppId: "730",
    steamAppIdProvenance: "USER",
    compatSnapshots: [
      { provider: "PROTONDB", result: { confidence: "strong", tier: "gold" }, fetchedAt: new Date("2026-09-01T00:00:00.000Z") },
      {
        provider: "ARE_WE_ANTICHEAT_YET",
        result: { appId: "730", name: "Game", status: "Denied", anticheats: ["EAC"] },
        fetchedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ],
    envCompat: [{ environment: "LINUX" as const, status: "REQUIRED" as const }],
  };

  it("maps confirmed base-game wishlist evidence", () => {
    expect(compatEvidenceForWish(baseRow)).toMatchObject({
      hasSteamIdentity: true,
      protonDbStatus: "READY",
      awayStatus: "Denied",
      protonDbFetchedAt: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it.each([
    ["missing provenance", { steamAppIdProvenance: null }],
    ["missing app id", { steamAppId: null }],
  ])("keeps %s identity unconfirmed", (_label, overrides) => {
    expect(compatEvidenceForWish({ ...baseRow, ...overrides })).toMatchObject({
      hasSteamIdentity: false,
      protonDbStatus: null,
      protonDbFetchedAt: null,
      awayStatus: null,
    });
  });

  it("does not inherit compatibility evidence for DLC wishes", () => {
    expect(compatEvidenceForWish({ ...baseRow, type: "DLC" })).toBeNull();
  });
});

describe("wishlist duration inputs", () => {
  const tune = {
    experience: null,
    length: "MEDIUM" as const,
    genres: [],
    tags: [],
    sequelPosture: null,
    era: null,
    maturity: null,
  };

  it("adds IGDB duration to Buy dimensions and length tuning", () => {
    const snapshot = { durationEvidence: { provider: "IGDB", payload: { normallySeconds: 9 * 3600 } } };
    const input = tuneInput(snapshot, null, 9);

    expect(resolveCandidateDimensionValues(snapshot, { gameExperience: null, preferredEnvironment: null, durationHours: input.durationHours })).toMatchObject({ DURATION: ["MEDIUM"] });
    expect(matchTuneCriteria(tune, input).criteria).toContain("length");
  });

  it("adds SteamSpy duration and leaves absent evidence soft", () => {
    const steamSpyInput = tuneInput(
      { durationEvidence: { provider: "STEAMSPY", payload: { medianForeverMinutes: 2_400 } } },
      null,
      40,
    );
    expect(resolveCandidateDimensionValues(null, { gameExperience: null, preferredEnvironment: null, durationHours: steamSpyInput.durationHours })).toMatchObject({ DURATION: ["LONG"] });
    expect(matchTuneCriteria({ ...tune, length: "LONG" }, steamSpyInput).criteria).toContain("length");

    const absent = tuneInput({ summary: "No duration evidence" }, null, null);
    expect(resolveCandidateDimensionValues(null, { gameExperience: null, preferredEnvironment: null, durationHours: absent.durationHours }).DURATION).toBeUndefined();
    expect(matchTuneCriteria(tune, absent).criteria).not.toContain("length");
  });
});
