import { describe, expect, it } from "vitest";
import { advanceIndex, shouldAutoAdvance } from "./carousel";

describe("advanceIndex", () => {
  it("wraps in both directions", () => {
    expect(advanceIndex(0, 3, "previous")).toBe(2);
    expect(advanceIndex(2, 3, "next")).toBe(0);
  });

  it("returns the safe index when there are no slides", () => {
    expect(advanceIndex(4, 0, "next")).toBe(0);
  });
});

describe("shouldAutoAdvance", () => {
  it("requires multiple slides, full motion, and no pause", () => {
    expect(shouldAutoAdvance(2, "full", false)).toBe(true);
    expect(shouldAutoAdvance(1, "full", false)).toBe(false);
    expect(shouldAutoAdvance(2, "full", true)).toBe(false);
  });

  it("keeps reduced motion fully manual", () => {
    expect(shouldAutoAdvance(2, "reduced", false)).toBe(false);
  });
});
