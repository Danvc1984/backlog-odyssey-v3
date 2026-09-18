import { describe, expect, it } from "vitest";
import { recommendationRoleLabel } from "./RecommendationRoleLabel";

describe("recommendationRoleLabel", () => {
  it("presents BEST_FIT_2 as You Might Also Enjoy for both recommendation kinds", () => {
    expect(recommendationRoleLabel("BEST_FIT_2", "PLAY_NEXT")).toBe("You might also enjoy");
    expect(recommendationRoleLabel("BEST_FIT_2", "BUY")).toBe("You might also enjoy");
  });
});
