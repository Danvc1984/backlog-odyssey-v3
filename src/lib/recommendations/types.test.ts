import { describe, expect, it } from "vitest";
import { tuneContextSchema, type TuneContext } from "./types";

const v1Tune: TuneContext = {
  experience: "COUCH_GAMING",
  length: "SHORT",
  genres: ["Puzzle"],
  tags: ["Singleplayer"],
  sequelPosture: "STANDALONE",
  era: "Y2020_PLUS",
  maturity: "CASUAL",
};

describe("tuneContextSchema", () => {
  it("keeps v1 tune objects valid without sourceTune", () => {
    const parsed = tuneContextSchema.safeParse(v1Tune);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      time: "UNDER_6",
      playStyle: null,
      familiarity: "BALANCED",
      handheld: false,
      experience: v1Tune.experience,
      genres: v1Tune.genres,
      tags: v1Tune.tags,
      sequelPosture: v1Tune.sequelPosture,
      era: v1Tune.era,
      maturity: v1Tune.maturity,
    });
  });

  it("round-trips the v2 sourceTune block", () => {
    const tune = {
      ...v1Tune,
      sourceTune: {
        steam: true,
        rom: false,
        allAlternatives: false,
        alternativeSourceIds: ["source-epic", "source-gog"],
      },
    };

    const parsed = tuneContextSchema.safeParse(JSON.parse(JSON.stringify(tune)));

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      time: "UNDER_6",
      playStyle: null,
      familiarity: "BALANCED",
      handheld: false,
      experience: tune.experience,
      genres: tune.genres,
      tags: tune.tags,
      sequelPosture: tune.sequelPosture,
      era: tune.era,
      maturity: tune.maturity,
      sourceTune: tune.sourceTune,
    });
  });
});
