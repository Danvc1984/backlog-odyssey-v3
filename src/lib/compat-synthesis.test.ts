import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { synthesizeCompatibility } from "./compat-synthesis";

const protonDb = (status: "READY" | "READY_WITH_TINKERING" = "READY") => ({
  appId: "620",
  confidence: "strong" as const,
  tier: "gold" as const,
  status,
  raw: {},
});
const away = (status: "Supported" | "Denied" | "Broken" | "Planned") => ({
  appId: "620",
  name: "Portal 2",
  status,
  anticheats: ["Easy Anti-Cheat"],
});
const game = { name: "Portal 2", hasSteamAppId: true };

describe("synthesizeCompatibility", () => {
  it("uses ProtonDB as the primary evidence for Linux", () => {
    const rows = synthesizeCompatibility({ protonDb: protonDb(), away: null, game });

    expect(rows).toEqual([
      { environment: "LINUX", status: "READY", source: "ProtonDB" },
      {
        environment: "WINDOWS",
        status: "READY",
        source: "Windows fallback is not needed because ProtonDB reports Linux ready without tinkering.",
      },
    ]);
  });

  it("requires Windows fallback when Linux has no ProtonDB evidence", () => {
    expect(synthesizeCompatibility({ protonDb: null, away: null, game })).toEqual([
      { environment: "LINUX", status: "UNKNOWN", source: "No ProtonDB evidence" },
      {
        environment: "WINDOWS",
        status: "REQUIRED",
        source: "Windows fallback is required because Linux compatibility is unknown.",
      },
    ]);
  });

  it.each(["Denied", "Broken"] as const)("keeps Linux on ProtonDB and requires Windows fallback for AWAY %s", (status) => {
    const rows = synthesizeCompatibility({ protonDb: protonDb(), away: away(status), game });

    expect(rows).toEqual([
      { environment: "LINUX", status: "READY", source: "ProtonDB" },
      {
        environment: "WINDOWS",
        status: "REQUIRED",
        source: `Windows fallback is required because AWAY reports Linux anti-cheat as ${status}.`,
      },
    ]);
  });

  it.each([
    ["READY_WITH_TINKERING", "FALLBACK_RECOMMENDED", "Windows fallback is recommended because Linux needs tinkering according to ProtonDB."],
    ["FALLBACK_RECOMMENDED", "FALLBACK_RECOMMENDED", "Windows fallback is recommended because ProtonDB reports degraded Linux compatibility."],
    ["REQUIRED", "REQUIRED", "Windows fallback is required because ProtonDB reports Linux as not playable."],
  ] as const)("maps Linux %s to Windows %s", (linuxStatus, windowsStatus, source) => {
    const rows = synthesizeCompatibility({
      protonDb: { ...protonDb(), status: linuxStatus },
      away: away("Planned"),
      game,
    });

    expect(rows[1]).toEqual({ environment: "WINDOWS", status: windowsStatus, source });
  });
});
