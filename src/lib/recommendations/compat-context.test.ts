import { describe, expect, it } from "vitest";

import { COMPAT_STALENESS_DAYS, buildCompatContext } from "./compat-context";
import type { CompatEvidenceInput } from "./types";

const now = new Date("2026-08-26T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function input(overrides: Partial<CompatEvidenceInput> = {}): CompatEvidenceInput {
  return {
    hasSteamIdentity: true,
    romOnly: false,
    overrideStatus: null,
    protonDbStatus: "UNKNOWN",
    protonDbFetchedAt: new Date(now.getTime() - 10 * DAY_MS),
    awayStatus: "Supported",
    ...overrides,
  };
}

describe("buildCompatContext", () => {
  it("emits the positive zero-point Bazzite factor when READY", () => {
    const verdict = buildCompatContext(input({ protonDbStatus: "READY" }), now);

    expect(verdict.positives).toEqual([
      { factor: "compat_bazzite", label: "Runs well on Bazzite", points: 0 },
    ]);
    expect(verdict.caveats).toEqual([]);
  });

  it("maps each non-ready status to its caveat factor", () => {
    expect(buildCompatContext(input({ protonDbStatus: "READY_WITH_TINKERING" }), now).caveats).toEqual([
      { factor: "compat_tinkering", label: "Needs tinkering on Bazzite" },
    ]);
    expect(buildCompatContext(input({ protonDbStatus: "FALLBACK_RECOMMENDED" }), now).caveats).toEqual([
      { factor: "compat_fallback", label: "Windows fallback recommended" },
    ]);
    expect(buildCompatContext(input({ protonDbStatus: "REQUIRED" }), now).caveats).toEqual([
      { factor: "compat_required", label: "Requires Windows to run" },
    ]);
    expect(buildCompatContext(input({ protonDbStatus: "UNKNOWN" }), now).caveats).toEqual([
      { factor: "compat_unknown", label: "Compatibility unknown" },
    ]);
  });

  it("lets the personal override take precedence over the snapshot", () => {
    const verdict = buildCompatContext(
      input({ overrideStatus: "REQUIRED", protonDbStatus: "READY" }),
      now,
    );

    expect(verdict.positives).toEqual([]);
    expect(verdict.caveats[0]?.factor).toBe("compat_required");
  });

  it("adds a stale caveat only past the 180-day window", () => {
    const boundary = buildCompatContext(
      input({ protonDbStatus: "READY", protonDbFetchedAt: new Date(now.getTime() - COMPAT_STALENESS_DAYS * DAY_MS) }),
      now,
    );
    expect(boundary.caveats).toEqual([]);

    const stale = buildCompatContext(
      input({ protonDbStatus: "READY", protonDbFetchedAt: new Date(now.getTime() - 181 * DAY_MS) }),
      now,
    );
    expect(stale.caveats).toEqual([
      { factor: "compat_stale", label: "Compatibility evidence is stale" },
    ]);
  });

  it("adds the anti-cheat caveat for Denied and Broken verdicts", () => {
    for (const status of ["Denied", "Broken"] as const) {
      const verdict = buildCompatContext(input({ protonDbStatus: "READY", awayStatus: status }), now);
      expect(verdict.caveats).toContainEqual({ factor: "anticheat", label: "Anti-cheat blocks Linux" });
    }

    const fine = buildCompatContext(input({ protonDbStatus: "READY", awayStatus: "Supported" }), now);
    expect(fine.caveats).toEqual([]);
  });

  it("reduces a ROM-only game to the neutral note with no other caveats", () => {
    const verdict = buildCompatContext(
      input({
        romOnly: true,
        protonDbStatus: "REQUIRED",
        awayStatus: "Broken",
        protonDbFetchedAt: new Date("2000-01-01T00:00:00.000Z"),
      }),
      now,
    );

    expect(verdict.positives).toEqual([]);
    expect(verdict.caveats).toEqual([
      { factor: "compat_na", label: "ROM only, compatibility not applicable" },
    ]);
  });

  it("yields compat_unknown when there is no Steam identity even with other signals", () => {
    const verdict = buildCompatContext(
      input({
        hasSteamIdentity: false,
        protonDbStatus: "READY",
        awayStatus: "Denied",
        protonDbFetchedAt: new Date("2000-01-01T00:00:00.000Z"),
      }),
      now,
    );

    expect(verdict.positives).toEqual([]);
    expect(verdict.caveats).toEqual([{ factor: "compat_unknown", label: "Compatibility unknown" }]);
  });
});
