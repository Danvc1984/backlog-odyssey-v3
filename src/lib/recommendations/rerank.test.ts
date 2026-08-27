import { describe, expect, it } from "vitest";
import type { RecommendationDimension } from "@/generated/prisma/client";
import type { CandidateDimensionValues, RecommendationProfilePayload } from "./profile";
import {
  limitedBasisCaveat,
  resolveRerankMode,
  scoreEnvironmentFit,
  scoreQuality,
  scoreSteamActivity,
  scoreTaste,
  selectColdStartPicks,
  type TastePreference,
} from "./rerank";

const DIMENSIONS: RecommendationDimension[] = [
  "GENRE",
  "TAG",
  "EXPERIENCE",
  "DURATION",
  "PUBLISHER",
  "ERA",
  "SERIES",
  "ENVIRONMENT",
  "MATURITY",
];

function profile(
  dimensions: Partial<Record<RecommendationDimension, Record<string, { weight: number; support: number }>>>,
): RecommendationProfilePayload {
  const all = Object.fromEntries(DIMENSIONS.map((key) => [key, {}])) as RecommendationProfilePayload["dimensions"];
  for (const [dimension, signals] of Object.entries(dimensions)) {
    all[dimension as RecommendationDimension] = Object.fromEntries(
      Object.entries(signals ?? {}).map(([value, signal]) => [value, { ...signal, lastAt: "2026-01-01T00:00:00.000Z" }]),
    );
  }
  return {
    version: 1,
    windowStart: null,
    windowEnd: "2026-01-01T00:00:00.000Z",
    dimensions: all,
    evidence: { eventsConsidered: 10, byKind: {}, unresolvedTargets: 0 },
  };
}

function dims(entries: Partial<Record<RecommendationDimension, string[]>>): CandidateDimensionValues {
  return entries;
}

const noPreferences: TastePreference[] = [];

describe("scoreTaste", () => {
  it("scales a single event at half strength and two or more at full strength", () => {
    const half = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 2, support: 1 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: noPreferences,
    });
    expect(half.points).toBe(1);
    expect(half.factors).toEqual([{ factor: "taste_profile", label: "RPG affinity", points: 1 }]);

    const full = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 2, support: 3 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: noPreferences,
    });
    expect(full.points).toBe(2);
  });

  it("clamps a dimension's derived contribution to ±3", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 9, support: 4 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: noPreferences,
    });
    expect(result.points).toBe(3);
    expect(result.factors).toEqual([{ factor: "taste_profile", label: "RPG affinity", points: 3 }]);
  });

  it("labels negative derived contributions as aversion", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { Horror: { weight: -1, support: 2 } } }),
      dimensionValues: dims({ GENRE: ["Horror"] }),
      preferences: noPreferences,
    });
    expect(result.factors).toEqual([{ factor: "taste_profile", label: "Horror aversion", points: -1 }]);
  });

  it("applies a PREFER override on top of the derived contribution", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 1, support: 2 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: [{ dimension: "GENRE", value: "RPG", attitude: "PREFER" }],
    });
    expect(result.points).toBe(5);
    expect(result.factors).toEqual([
      { factor: "preference", label: "You marked RPG as preferred", points: 4 },
      { factor: "taste_profile", label: "RPG affinity", points: 1 },
    ]);
  });

  it("veto: NEUTRAL suppresses the dimension's derived contribution entirely", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 2, support: 2 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: [{ dimension: "GENRE", value: "RPG", attitude: "NEUTRAL" }],
    });
    expect(result.points).toBe(0);
    expect(result.factors).toEqual([]);
  });

  it("resolves conflicting attitudes with AVOID beating PREFER", () => {
    const result = scoreTaste({
      profile: profile({ MATURITY: {} }),
      dimensionValues: dims({ MATURITY: ["Mature"] }),
      preferences: [
        { dimension: "MATURITY", value: "Mature", attitude: "PREFER" },
        { dimension: "MATURITY", value: "Mature", attitude: "AVOID" },
      ],
    });
    expect(result.points).toBe(-6);
    expect(result.factors).toEqual([{ factor: "preference", label: "You avoid Mature", points: -6 }]);
  });

  it("caps the combined taste adjustment at ±12, keeping the strongest first", () => {
    const strong = profile({
      GENRE: { RPG: { weight: 9, support: 4 } },
      TAG: { "Story Rich": { weight: 9, support: 4 } },
      ERA: { Y2020_PLUS: { weight: 9, support: 4 } },
      DURATION: { LONG: { weight: 9, support: 4 } },
      PUBLISHER: { Valve: { weight: 9, support: 4 } },
    });
    const result = scoreTaste({
      profile: strong,
      dimensionValues: dims({
        GENRE: ["RPG"],
        TAG: ["Story Rich"],
        ERA: ["Y2020_PLUS"],
        DURATION: ["LONG"],
        PUBLISHER: ["Valve"],
      }),
      preferences: noPreferences,
    });
    expect(result.points).toBe(12);
    expect(result.factors).toHaveLength(4);
    for (const factor of result.factors) {
      expect(factor.points).toBe(3);
    }
  });

  it("gives a zero-evidence candidate nothing", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 2, support: 5 } } }),
      dimensionValues: dims({}),
      preferences: noPreferences,
    });
    expect(result).toEqual({ points: 0, factors: [] });
  });

  it("matches preference values case-sensitively", () => {
    const result = scoreTaste({
      profile: profile({ GENRE: { RPG: { weight: 1, support: 2 } } }),
      dimensionValues: dims({ GENRE: ["RPG"] }),
      preferences: [{ dimension: "GENRE", value: "rpg", attitude: "PREFER" }],
    });
    expect(result.points).toBe(1);
    expect(result.factors).toEqual([{ factor: "taste_profile", label: "RPG affinity", points: 1 }]);
  });
});

describe("scoreSteamActivity", () => {
  const now = new Date("2026-08-27T00:00:00.000Z");
  const base = { replayCandidate: false, playState: "PLAYED_BEFORE" as const };

  it.each([
    [179, 2],
    [180, 2],
    [181, null],
  ])("applies recency only within 180 days (%i days -> %p)", (days, expected) => {
    const lastPlayed = new Date(now.getTime() - days * 86400000);
    const factor = scoreSteamActivity(
      { ...base, replayCandidate: true, steamLastPlayed: lastPlayed },
      now,
    );
    expect(factor === null ? null : factor.points).toBe(expected);
    if (factor) expect(factor.factor).toBe("steam_recent");
  });

  it("applies for abandoned candidates within the window", () => {
    const factor = scoreSteamActivity(
      { playState: "ABANDONED", replayCandidate: false, steamLastPlayed: new Date(now.getTime() - 30 * 86400000) },
      now,
    );
    expect(factor?.points).toBe(2);
  });

  it("yields no factor for future dates, absent dates, or non-replay candidates", () => {
    expect(
      scoreSteamActivity({ ...base, replayCandidate: true, steamLastPlayed: new Date(now.getTime() + 86400000) }, now),
    ).toBeNull();
    expect(scoreSteamActivity({ playState: "PLAYED_BEFORE", replayCandidate: true, steamLastPlayed: null }, now)).toBeNull();
    expect(
      scoreSteamActivity(
        { playState: "NOT_STARTED", replayCandidate: false, steamLastPlayed: new Date(now.getTime() - 86400000) },
        now,
      ),
    ).toBeNull();
    expect(
      scoreSteamActivity(
        { playState: "PLAYED_BEFORE", replayCandidate: false, steamLastPlayed: new Date(now.getTime() - 86400000) },
        now,
      ),
    ).toBeNull();
  });
});

describe("scoreEnvironmentFit", () => {
  it.each([
    ["READY", 2],
    ["READY_WITH_TINKERING", 1],
    ["FALLBACK_RECOMMENDED", -2],
    ["REQUIRED", -3],
    ["UNKNOWN", null],
    [null, null],
  ])("maps %s to %p points", (status, expected) => {
    const factor = scoreEnvironmentFit(status as Parameters<typeof scoreEnvironmentFit>[0]);
    expect(factor === null ? null : factor.points).toBe(expected);
  });

  it("labels each status in plain English", () => {
    expect(scoreEnvironmentFit("READY_WITH_TINKERING")?.label).toBe("Ready with tinkering");
    expect(scoreEnvironmentFit("REQUIRED")?.label).toBe("Requires extra setup");
  });
});

describe("scoreQuality", () => {
  it.each([
    [54, -1],
    [55, 0],
    [84, 0],
    [85, 2],
  ])("metacritic %i -> %p", (metacritic, expected) => {
    const factor = scoreQuality({ metacriticScore: metacritic, rating: null });
    expect(factor === null ? 0 : factor.points).toBe(expected);
  });

  it.each([
    [4.4, 0],
    [4.5, 1],
  ])("rating %p -> %p", (rating, expected) => {
    const factor = scoreQuality({ metacriticScore: null, rating });
    expect(factor === null ? 0 : factor.points).toBe(expected);
  });

  it("combines and clamps at +3 when both quality signals are high", () => {
    const factor = scoreQuality({ metacriticScore: 95, rating: 4.8 });
    expect(factor?.points).toBe(3);
    expect(factor?.label).toBe("Metacritic 95, RAWG rating 4.8");
  });

  it("yields no factor when signals cancel or are absent", () => {
    expect(scoreQuality({ metacriticScore: 40, rating: 4.9 })).toBeNull();
    expect(scoreQuality({ metacriticScore: null, rating: null })).toBeNull();
  });
});

describe("resolveRerankMode", () => {
  it("enters cold start below the event threshold even with taste evidence", () => {
    const p = profile({ GENRE: { RPG: { weight: 1, support: 4 } } });
    p.evidence.eventsConsidered = 4;
    expect(resolveRerankMode(p)).toBe("COLD_START");
  });

  it("stays reranked at the threshold with taste evidence", () => {
    const p = profile({ GENRE: { RPG: { weight: 1, support: 4 } } });
    p.evidence.eventsConsidered = 5;
    expect(resolveRerankMode(p)).toBe("RERANKED");
  });

  it("enters cold start when every taste dimension is empty regardless of volume", () => {
    const p = profile({});
    p.evidence.eventsConsidered = 50;
    expect(resolveRerankMode(p)).toBe("COLD_START");
  });
});

describe("selectColdStartPicks", () => {
  const item = (id: string, genres: string[]) => ({ id, genres });

  it("skips a shared-genre item while a different-genre item remains", () => {
    const picks = selectColdStartPicks(
      [item("a", ["RPG"]), item("b", ["RPG"]), item("c", ["Strategy"])],
      3,
    );
    expect(picks.map((pick) => pick.id)).toEqual(["a", "c", "b"]);
  });

  it("falls through in baseline order when variety is exhausted", () => {
    const picks = selectColdStartPicks(
      [item("a", ["RPG"]), item("b", ["RPG"]), item("c", ["RPG"])],
      3,
    );
    expect(picks.map((pick) => pick.id)).toEqual(["a", "b", "c"]);
  });

  it("respects the limit and takes genre-less items immediately", () => {
    const picks = selectColdStartPicks(
      [item("a", []), item("b", ["RPG"]), item("c", ["RPG", "Indie"]), item("d", ["Strategy"])],
      3,
    );
    expect(picks.map((pick) => pick.id)).toEqual(["a", "b", "d"]);
  });
});

describe("limitedBasisCaveat", () => {
  it("carries the cold-start caveat", () => {
    expect(limitedBasisCaveat()).toEqual({
      factor: "limited_basis",
      label: "Cold start: limited history, showing a varied mix",
    });
  });
});
