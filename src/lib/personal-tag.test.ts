import { describe, expect, it } from "vitest";
import { normalizePersonalTagName, preparePersonalTagName } from "./personal-tag";

describe("personal tag identity", () => {
  it("trims display names and derives a locale-lowercase key", () => {
    expect(preparePersonalTagName("  RPG  ")).toEqual({ name: "RPG", normalizedName: "rpg" });
    expect(normalizePersonalTagName("  Niño ")).toBe("niño");
  });

  it("rejects no identity only through the caller's validation", () => {
    expect(preparePersonalTagName("   ")).toEqual({ name: "", normalizedName: "" });
  });
});
