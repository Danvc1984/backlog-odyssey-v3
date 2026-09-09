import { describe, expect, it } from "vitest";

import {
  classifyPlayPracticality,
  compatContributes,
  availableEnvironments,
  formatPlayExclusionReasons,
  resolvePlayEnvStatus,
  type EnvironmentCompatibilityRow,
} from "./environment-fit";
import type { CompatEvidenceInput } from "./types";
import type { OsSetup } from "@/lib/os-setup";

const linuxOnly: OsSetup = {
  primaryOs: "LINUX",
  hasWindowsFallback: false,
  handheldOs: "NONE",
  onboardingCompleted: true,
};
const linuxWithFallback = { ...linuxOnly, hasWindowsFallback: true };
const allWindows: OsSetup = {
  primaryOs: "WINDOWS",
  hasWindowsFallback: false,
  handheldOs: "WINDOWS",
  onboardingCompleted: true,
};
const windowsPrimaryLinuxHandheld: OsSetup = {
  ...allWindows,
  handheldOs: "LINUX",
};
const rows: EnvironmentCompatibilityRow[] = [
  { environment: "LINUX", status: "READY" },
  { environment: "WINDOWS", status: "REQUIRED" },
];

function evidence(overrides: Partial<CompatEvidenceInput> = {}): CompatEvidenceInput {
  return {
    hasSteamIdentity: true,
    romOnly: false,
    overrideStatus: null,
    overrideReason: null,
    protonDbStatus: "UNKNOWN",
    protonDbFetchedAt: null,
    awayStatus: "Supported",
    ...overrides,
  };
}

describe("environment fit", () => {
  it.each([
    ["Linux primary only", linuxOnly, ["LINUX"]],
    ["Linux primary with fallback", linuxWithFallback, ["LINUX", "WINDOWS"]],
    ["Linux primary with Windows handheld", { ...linuxOnly, handheldOs: "WINDOWS" as const }, ["LINUX", "WINDOWS"]],
    ["Linux primary with Linux handheld", { ...linuxOnly, handheldOs: "LINUX" as const }, ["LINUX", "STEAM_DECK"]],
    ["Windows primary only", { ...allWindows, handheldOs: "NONE" as const }, ["WINDOWS"]],
    ["Windows primary with Linux handheld", { ...allWindows, handheldOs: "LINUX" as const }, ["LINUX", "STEAM_DECK", "WINDOWS"]],
  ] as const)("derives configured environments for %s", (_label, setup, expected) => {
    expect(availableEnvironments(setup)).toEqual(expected);
  });

  it("gates compatibility on the presence of a Linux target", () => {
    expect(compatContributes(linuxOnly)).toBe(true);
    expect(compatContributes({ ...allWindows, handheldOs: "NONE" })).toBe(false);
    expect(compatContributes({ ...allWindows, primaryOs: "WINDOWS", handheldOs: "LINUX" })).toBe(true);
  });

  it("uses a configured preferred device, maps Steam Deck to Linux, and falls back to Linux evidence", () => {
    expect(resolvePlayEnvStatus(linuxWithFallback, "WINDOWS", rows)).toBe("REQUIRED");
    expect(resolvePlayEnvStatus(linuxOnly, "WINDOWS", rows)).toBe("READY");
    expect(resolvePlayEnvStatus({ ...linuxOnly, handheldOs: "LINUX" }, "STEAM_DECK", rows)).toBe("READY");
    expect(resolvePlayEnvStatus(linuxOnly, null, rows)).toBe("READY");
    expect(resolvePlayEnvStatus(allWindows, "WINDOWS", rows)).toBeNull();
  });

  it("classifies playable, soft, and excluded evidence across setup shapes", () => {
    expect(classifyPlayPracticality(linuxOnly, evidence({ protonDbStatus: "READY" }))).toEqual({ kind: "PLAYABLE" });
    expect(classifyPlayPracticality(linuxWithFallback, evidence({ protonDbStatus: "REQUIRED" }))).toEqual({
      kind: "SOFT",
      reason: { factor: "compat_required", label: "Requires Windows to run" },
    });
    expect(classifyPlayPracticality(linuxOnly, evidence({ protonDbStatus: "REQUIRED" })).kind).toBe("EXCLUDED");
    expect(classifyPlayPracticality(linuxOnly, evidence({ awayStatus: "Denied" })).kind).toBe("EXCLUDED");
    expect(classifyPlayPracticality(linuxWithFallback, evidence({ awayStatus: "Broken" })).kind).toBe("SOFT");
    expect(classifyPlayPracticality(allWindows, evidence({ protonDbStatus: "REQUIRED", awayStatus: "Denied" })).kind).toBe("PLAYABLE");
    expect(classifyPlayPracticality(windowsPrimaryLinuxHandheld, evidence({ protonDbStatus: "REQUIRED" }))).toEqual({
      kind: "SOFT",
      reason: { factor: "compat_required", label: "Requires Windows to run" },
    });
    expect(classifyPlayPracticality(windowsPrimaryLinuxHandheld, evidence({ awayStatus: "Denied" }))).toEqual({
      kind: "SOFT",
      reason: { factor: "anticheat", label: "Anti-cheat blocks Linux" },
    });
  });

  it("lets personal overrides win and keeps ROM and unknown evidence soft", () => {
    expect(classifyPlayPracticality(linuxOnly, evidence({ overrideStatus: "READY", protonDbStatus: "REQUIRED", awayStatus: "Denied" }))).toEqual({ kind: "PLAYABLE" });
    expect(classifyPlayPracticality(linuxOnly, evidence({ romOnly: true, protonDbStatus: "REQUIRED" }))).toEqual({
      kind: "PLAYABLE",
      reason: { factor: "compat_na", label: "ROM only, compatibility not applicable" },
    });
    expect(classifyPlayPracticality(linuxOnly, evidence({ protonDbStatus: "UNKNOWN" }))).toEqual({
      kind: "SOFT",
      reason: { factor: "compat_unknown", label: "Compatibility unknown" },
    });
  });

  it("deduplicates stored exclusion reasons for the Today message", () => {
    expect(formatPlayExclusionReasons([
      { reason: { label: "Requires Windows to run, but no Windows fallback is configured" } },
      { reason: { label: "Requires Windows to run, but no Windows fallback is configured" } },
      { reason: { label: "Anti-cheat blocks Linux, and no Windows fallback is configured" } },
    ])).toBe(
      "Requires Windows to run, but no Windows fallback is configured; Anti-cheat blocks Linux, and no Windows fallback is configured",
    );
    expect(formatPlayExclusionReasons([{ reason: null }])).toBeNull();
  });
});
