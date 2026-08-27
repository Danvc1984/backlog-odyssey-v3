import { describe, expect, it } from "vitest";
import {
  decayFactor,
  durationBand,
  eraBucket,
  EVENT_SIGNAL_WEIGHTS,
  profileDimensionKeys,
  resolveCandidateDimensionValues,
  tasteSetupWeight,
} from "./profile";

describe("recommendation profile math", () => {
  it("maps duration boundaries", () => {
    expect(durationBand(5)).toBe("SHORT");
    expect(durationBand(6)).toBe("MEDIUM");
    expect(durationBand(15)).toBe("MEDIUM");
    expect(durationBand(16)).toBe("LONG");
    expect(durationBand(40)).toBe("LONG");
    expect(durationBand(41)).toBe("VERY_LONG");
    expect(durationBand(null)).toBeNull();
  });

  it("maps release year boundaries", () => {
    expect(eraBucket("2004-01-01")).toBe("PRE_2005");
    expect(eraBucket("2005-01-01")).toBe("Y2005_2014");
    expect(eraBucket("2014-01-01")).toBe("Y2005_2014");
    expect(eraBucket("2015-01-01")).toBe("Y2015_2019");
    expect(eraBucket("2019-01-01")).toBe("Y2015_2019");
    expect(eraBucket("2020-01-01")).toBe("Y2020_PLUS");
    expect(eraBucket("not-a-date")).toBeNull();
  });

  it("applies exponential decay", () => {
    expect(decayFactor(0)).toBe(1);
    expect(decayFactor(180)).toBe(0.5);
    expect(decayFactor(360)).toBe(0.25);
    expect(decayFactor(180)).toBeLessThan(decayFactor(90));
  });

  it("exposes event and taste setup weights", () => {
    expect(EVENT_SIGNAL_WEIGHTS).toMatchObject({ START: 1, COMPLETION: 2, ABANDONMENT: -1, DISMISSAL: -1.5 });
    expect(tasteSetupWeight("LIKED")).toBe(2);
    expect(tasteSetupWeight("PLAYED")).toBe(1);
    expect(tasteSetupWeight("SKIPPED")).toBe(0);
  });

  it("keeps the contract dimension order", () => {
    expect(profileDimensionKeys()).toEqual([
      "GENRE", "TAG", "EXPERIENCE", "DURATION", "PUBLISHER", "ERA", "SERIES", "ENVIRONMENT", "MATURITY",
    ]);
  });
});

describe("candidate dimension resolution", () => {
  const v2Payload = {
    title: "Portal 2",
    genres: ["Puzzle", ""],
    tags: ["Singleplayer"],
    publishers: ["Valve", "Aperture"],
    releaseDate: "2011-04-18",
    playtimeHours: 9,
    esrbRating: { name: "Everyone 10+", slug: "everyone-10-plus" },
    seriesGames: [
      { rawgId: 1, name: "Portal", slug: "portal", released: "2007-10-09" },
      { rawgId: 2, name: "", slug: null, released: null },
    ],
  };

  it("resolves metadata, maturity, series, and personal fields from a v2 payload", () => {
    expect(
      resolveCandidateDimensionValues(v2Payload, {
        gameExperience: "PLAYED",
        preferredEnvironment: "READY",
      }),
    ).toEqual({
      GENRE: ["Puzzle"],
      TAG: ["Singleplayer"],
      PUBLISHER: ["Valve"],
      ERA: ["Y2005_2014"],
      DURATION: ["MEDIUM"],
      MATURITY: ["Everyone 10+"],
      SERIES: ["Portal"],
      EXPERIENCE: ["PLAYED"],
      ENVIRONMENT: ["READY"],
    });
  });

  it("contributes no maturity or series values from a v1 payload", () => {
    const v1Payload = {
      title: "Portal 2",
      genres: ["Puzzle"],
      tags: [],
      publishers: ["Valve"],
      releaseDate: "2011-04-18",
      playtimeHours: 9,
    };

    expect(
      resolveCandidateDimensionValues(v1Payload, { gameExperience: null, preferredEnvironment: null }),
    ).toEqual({
      GENRE: ["Puzzle"],
      TAG: [],
      PUBLISHER: ["Valve"],
      ERA: ["Y2005_2014"],
      DURATION: ["MEDIUM"],
    });
  });

  it("keeps personal fields verbatim when the payload is unusable", () => {
    expect(
      resolveCandidateDimensionValues(null, {
        gameExperience: "REPLAYING",
        preferredEnvironment: null,
      }),
    ).toEqual({ EXPERIENCE: ["REPLAYING"] });
  });
});
