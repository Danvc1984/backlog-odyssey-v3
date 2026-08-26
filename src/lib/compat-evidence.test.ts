import { describe, expect, it } from "vitest";
import { parseAntiCheatEvidence } from "./compat-evidence";

describe("parseAntiCheatEvidence", () => {
  it("parses a valid stored AWAY result", () => {
    expect(
      parseAntiCheatEvidence({ status: "Denied", anticheats: ["EAC", "BattlEye"] }),
    ).toEqual({ status: "Denied", anticheats: ["EAC", "BattlEye"] });
    expect(parseAntiCheatEvidence({ status: "Supported", anticheats: [] })).toEqual({
      status: "Supported",
      anticheats: [],
    });
  });

  it("rejects non-object payloads", () => {
    expect(parseAntiCheatEvidence(null)).toBeNull();
    expect(parseAntiCheatEvidence("Denied")).toBeNull();
    expect(parseAntiCheatEvidence(undefined)).toBeNull();
  });

  it("rejects unknown status values", () => {
    expect(parseAntiCheatEvidence({ status: "Unknown", anticheats: [] })).toBeNull();
    expect(parseAntiCheatEvidence({ anticheats: [] })).toBeNull();
  });

  it("rejects malformed anticheat lists", () => {
    expect(parseAntiCheatEvidence({ status: "Running" })).toBeNull();
    expect(parseAntiCheatEvidence({ status: "Broken", anticheats: "EAC" })).toBeNull();
    expect(parseAntiCheatEvidence({ status: "Planned", anticheats: [1] })).toBeNull();
  });
});
