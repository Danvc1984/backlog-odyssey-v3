import { describe, expect, it } from "vitest";
import {
  consolidateCompletionEvents,
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

  it("keeps only the latest completion signal per game", () => {
    const first = { kind: "COMPLETION" as const, gameId: "g1", createdAt: new Date("2026-01-01") };
    const second = { kind: "COMPLETION" as const, gameId: "g1", createdAt: new Date("2026-02-01") };
    const abandonment = { kind: "ABANDONMENT" as const, gameId: "g1", createdAt: new Date("2026-03-01") };

    expect(consolidateCompletionEvents([first, second, abandonment])).toEqual([second, abandonment]);
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
    schemaVersion: 1,
    igdbId: 1,
    igdbSlug: "portal-2",
    name: "Portal 2",
    summary: null,
    firstReleaseDate: "2011-04-18T00:00:00.000Z",
    genres: [{ id: 1, name: "Puzzle" }],
    themes: [],
    keywords: [{ id: 2, name: "Singleplayer" }],
    developers: [],
    publishers: [{ id: 3, name: "Valve" }],
    esrbRating: "Everyone 10+",
    officialWebsite: null,
    alternativeNames: [],
    ratings: { aggregated: { score: null, count: null }, community: { score: null, count: null }, total: { score: null, count: null } },
    collection: { id: 4, name: "Portal" },
    franchise: null,
    relations: [],
    gameModes: [],
    multiplayerModes: [],
    coverUrl: null,
    artworkUrls: [],
    conceptArtUrls: [],
    screenshots: [],
    igdbUpdatedAt: null,
    attribution: { provider: "IGDB", sourceUrl: "https://www.igdb.com/games/portal-2", fetchedAt: "2026-01-01T00:00:00.000Z" },
    palette: null,
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
      MATURITY: ["Everyone 10+"],
      SERIES: ["Portal"],
      EXPERIENCE: ["PLAYED"],
      ENVIRONMENT: ["READY"],
    });
  });

  it("contributes no maturity or series values from a v1 payload", () => {
    const v1Payload = {
      ...v2Payload,
      genres: [{ id: 1, name: "Puzzle" }],
      keywords: [],
      publishers: [{ id: 3, name: "Valve" }],
      esrbRating: null,
      collection: null,
    };

    expect(
      resolveCandidateDimensionValues(v1Payload, { gameExperience: null, preferredEnvironment: null }),
    ).toEqual({
      GENRE: ["Puzzle"],
      TAG: [],
      PUBLISHER: ["Valve"],
      ERA: ["Y2005_2014"],
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

  it("adds a duration band when duration evidence resolves to hours", () => {
    expect(
      resolveCandidateDimensionValues(null, {
        gameExperience: null,
        preferredEnvironment: null,
        durationHours: 9,
      }),
    ).toEqual({ DURATION: ["MEDIUM"] });
  });

  it("skips a preferred environment that is not configured", () => {
    expect(
      resolveCandidateDimensionValues(null, {
        gameExperience: "PC_GAMING",
        preferredEnvironment: "WINDOWS",
        configuredEnvironments: ["LINUX"],
      }),
    ).toEqual({ EXPERIENCE: ["PC_GAMING"] });
  });
});
