import { describe, expect, it } from "vitest";
import { prepareRecommendationFactors } from "./factor-presentation";

describe("prepareRecommendationFactors", () => {
  it("handles empty and single-factor lists", () => {
    expect(prepareRecommendationFactors([], [], [])).toEqual({ positive: [], negative: [], caveats: [] });
    expect(prepareRecommendationFactors(
      [{ factor: "interest", label: "Interest", points: 4 }],
      [],
      [],
    ).positive).toEqual([{ factor: "interest", label: "Interest", points: 4 }]);
  });

  it("aggregates matching factors and merges taste fragments", () => {
    const result = prepareRecommendationFactors([
      { factor: "taste_profile", label: "Matches your taste for action games", points: 2 },
      { factor: "taste_profile", label: "Matches your taste for roguelike games", points: 1 },
      { factor: "taste_profile", label: "Matches your taste for action games", points: 1 },
    ], [], []);

    expect(result.positive).toEqual([{
      factor: "taste_profile",
      label: "Matches your taste for action and roguelike games",
      points: 4,
    }]);
  });

  it("combines taste and preference clauses without repeating the same opener", () => {
    const result = prepareRecommendationFactors([
      { factor: "taste_profile", label: "Matches your taste for action games", points: 2 },
      { factor: "taste_profile", label: "Matches your taste for singleplayer games", points: 1 },
      { factor: "taste_profile", label: "Matches your preference for mature games", points: 1 },
    ], [], []);

    expect(result.positive[0]?.label).toBe(
      "Matches your taste for action and singleplayer games and your preference for mature games",
    );
  });

  it("orders positive factors strongest first and negative factors weakest first", () => {
    const result = prepareRecommendationFactors(
      [
        { factor: "interest", label: "Interest", points: 2 },
        { factor: "quality", label: "Quality", points: 5 },
        { factor: "priority", label: "Priority", points: 5 },
      ],
      [
        { factor: "calibration", label: "Dismissed often", points: -20 },
        { factor: "abandoned", label: "Set aside", points: -2 },
      ],
      [
        { factor: "compat_unknown", label: "Compatibility unknown" },
        { factor: "stale_offer", label: "Price data is stale" },
      ],
    );

    expect(result.positive.map((factor) => factor.factor)).toEqual(["quality", "priority", "interest"]);
    expect(result.negative.map((factor) => factor.factor)).toEqual(["abandoned", "calibration"]);
    expect(result.caveats.map((caveat) => caveat.factor)).toEqual(["compat_unknown", "stale_offer"]);
  });
});
