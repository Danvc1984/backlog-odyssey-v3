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
    expect(parsed.success && parsed.data).toEqual(v1Tune);
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
    expect(parsed.success && parsed.data).toEqual(tune);
  });
});
