import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  applyFamiliarity,
  applySourceTune,
  countTuneMatches,
  filterPlayTune,
  matchPlayStyle,
  matchSourceTune,
  matchTuneCriteria,
  type TuneCandidateInput,
} from "./tune";
import type { TuneContext } from "./types";

const emptyTune: TuneContext = {
  experience: null,
  length: null,
  genres: [],
  tags: [],
  sequelPosture: null,
  era: null,
  maturity: null,
};

const source = (source: "STEAM" | "ROM" | "OTHER_PLATFORM", alternativeSourceId: string | null = null) => ({
  source,
  alternativeSourceId,
});

const candidate = (overrides: Partial<TuneCandidateInput> = {}): TuneCandidateInput => ({
  experience: "COUCH_GAMING",
  releaseDate: "2020-01-01",
  genres: ["Puzzle"],
  tags: ["Co-op"],
  esrbRating: { name: "Everyone 10+" },
  seriesGames: [],
  ...overrides,
});

describe("matchPlayStyle", () => {
  it("matches known solo, online, and couch signals", () => {
    expect(matchPlayStyle("SOLO", candidate({ gameModes: ["Single-player"] }))).toBe("MATCH");
    expect(matchPlayStyle("ONLINE", candidate({ multiplayerModes: ["Online co-op"] }))).toBe("MATCH");
    expect(matchPlayStyle("COUCH", candidate({ multiplayerModes: ["Offline co-op"] }))).toBe("MATCH");
  });

  it("excludes known conflicting signals and preserves unknown metadata as unknown", () => {
    expect(matchPlayStyle("SOLO", candidate({ multiplayerModes: ["Online co-op"] }))).toBe("CONFLICT");
    expect(matchPlayStyle("ONLINE", candidate({ gameModes: ["Single-player"] }))).toBe("CONFLICT");
    expect(matchPlayStyle("COUCH", candidate())).toBe("UNKNOWN");
  });
});

describe("matchTuneCriteria", () => {
  it("matches experience, era, genres, tags, and casual maturity", () => {
    const match = matchTuneCriteria({ ...emptyTune, experience: "COUCH_GAMING", length: "SHORT", era: "Y2020_PLUS", genres: ["Puzzle"], tags: ["Co-op"], maturity: "CASUAL" }, candidate());
    expect(match).toEqual({ points: 10, criteria: ["experience", "genre", "tag", "era", "maturity"] });
  });

  it.each(["Teen", "Mature", "Adults Only"])("matches %s as mature", (rating) => {
    expect(matchTuneCriteria({ ...emptyTune, maturity: "MATURE" }, candidate({ esrbRating: { name: rating } })).criteria).toContain("maturity");
  });

  it("does not match unknown or missing ratings", () => {
    const tune = { ...emptyTune, maturity: "CASUAL" as const };
    expect(matchTuneCriteria(tune, candidate({ esrbRating: null })).criteria).toEqual([]);
    expect(matchTuneCriteria(tune, candidate({ esrbRating: { name: "Rating Pending" } })).criteria).toEqual([]);
  });

  it("matches a sequel only when a later series entry exists", () => {
    const tune = { ...emptyTune, sequelPosture: "SEQUEL" as const };
    const seriesGames = [{ name: "Later", releaseDate: "2021-01-01" }];
    expect(matchTuneCriteria(tune, candidate({ seriesGames })).criteria).toContain("sequelPosture");
    expect(matchTuneCriteria(tune, candidate({ releaseDate: null, seriesGames })).criteria).toEqual([]);
  });

  it("treats missing v1 series data as standalone", () => {
    const tune = { ...emptyTune, sequelPosture: "STANDALONE" as const };
    expect(matchTuneCriteria(tune, candidate({ seriesGames: undefined })).criteria).toContain("sequelPosture");
    expect(matchTuneCriteria(tune, candidate({ seriesGames: [{ name: "Later", releaseDate: "2021-01-01" }] })).criteria).toEqual([]);
  });

  it("caps the bonus at ten points and gives zero to a zero-criteria tune", () => {
    const allCriteria = { ...emptyTune, experience: "COUCH_GAMING" as const, length: "SHORT" as const, genres: ["Puzzle"], tags: ["Co-op"], era: "Y2020_PLUS" as const, maturity: "CASUAL" as const };
    expect(matchTuneCriteria(allCriteria, candidate()).points).toBe(10);
    expect(matchTuneCriteria(emptyTune, candidate()).points).toBe(0);
  });

  it("matches a candidate's duration band to the length tune", () => {
    const match = matchTuneCriteria({ ...emptyTune, length: "SHORT" }, candidate({ durationHours: 4 }));
    expect(match).toEqual({ points: 5, criteria: ["length"] });
    expect(matchTuneCriteria({ ...emptyTune, length: "LONG" }, candidate({ durationHours: 4 })).criteria).toEqual([]);
  });

  it.each([
    ["UNDER_6", 5, true],
    ["6_20", 6, true],
    ["6_20", 20, true],
    ["20_50", 21, true],
    ["20_50", 50, true],
    ["OVER_50", 51, true],
    ["UNDER_6", 6, false],
  ] as const)("matches time range %s at %sh", (time, hours, matches) => {
    expect(matchTuneCriteria({ ...emptyTune, time }, candidate({ durationHours: hours })).criteria.includes("time")).toBe(matches);
  });

  it("matches a selected play style without treating generic modes as known", () => {
    expect(matchTuneCriteria({ ...emptyTune, playStyle: "ONLINE" }, candidate({ multiplayerModes: ["Online co-op"] })).criteria).toContain("playStyle");
    expect(matchTuneCriteria({ ...emptyTune, playStyle: "ONLINE" }, candidate({ gameModes: ["Multiplayer"] })).criteria).not.toContain("playStyle");
  });
});

describe("filterPlayTune", () => {
  it("strictly filters handheld and conflicting play-style candidates", () => {
    const tune = { ...emptyTune, handheld: true, playStyle: "SOLO" as const };
    const inputs = new Map([
      ["handheld", candidate({ gameModes: ["Single-player"], handheldSuitable: true })],
      ["desktop", candidate({ gameModes: ["Single-player"], handheldSuitable: false })],
      ["online", candidate({ multiplayerModes: ["Online co-op"], handheldSuitable: true })],
      ["unknown", candidate({ handheldSuitable: true })],
    ]);
    const result = filterPlayTune(
      [...inputs.keys()].map((id) => ({ id, caveats: [] as never[] })),
      tune,
      inputs,
    );
    expect(result.map((item) => item.id)).toEqual(["handheld", "unknown"]);
    expect(result[1]?.caveats).toContainEqual({ factor: "tune_unknown", label: "Play style metadata is unavailable" });
  });
});

describe("applyFamiliarity", () => {
  const pool = [
    { id: "familiar", tastePoints: 3, caveats: [] as never[] },
    { id: "different", tastePoints: 0, caveats: [] as never[] },
  ];

  it("keeps normal ranking for Balanced and filters strictly for Different", () => {
    expect(applyFamiliarity(pool, "BALANCED").map((item) => item.id)).toEqual(["familiar", "different"]);
    expect(applyFamiliarity(pool, "DIFFERENT").map((item) => item.id)).toEqual(["different"]);
  });

  it("marks a missing familiarity signal while retaining the candidate", () => {
    expect(applyFamiliarity(pool, "FAMILIAR")[1]?.caveats).toContainEqual({ factor: "tune_unknown", label: "No familiarity signal yet, using normal ranking" });
  });
});

describe("countTuneMatches", () => {
  it("marks a thin pool against the play and buy display thresholds", () => {
    const tune = { ...emptyTune, genres: ["Puzzle"] };
    const candidates = [candidate(), candidate({ genres: ["RPG"] }), candidate({ genres: ["RPG"] }), candidate({ genres: ["RPG"] })];
    expect(countTuneMatches(tune, candidates, 4)).toEqual({ matchingCount: 1, thinPool: true });
    expect(countTuneMatches(tune, candidates, 3)).toEqual({ matchingCount: 1, thinPool: true });
    expect(countTuneMatches(tune, [candidate(), candidate({ genres: ["Puzzle"] }), candidate({ genres: ["Puzzle"] })], 3).thinPool).toBe(false);
  });
});

describe("matchSourceTune", () => {
  it("matches each selected built-in source inclusively", () => {
    const sources = [source("STEAM"), source("ROM"), source("OTHER_PLATFORM", "epic")];

    expect(matchSourceTune({ steam: true, rom: false, allAlternatives: false, alternativeSourceIds: [] }, sources)).toEqual([sources[0]]);
    expect(matchSourceTune({ steam: false, rom: true, allAlternatives: false, alternativeSourceIds: [] }, sources)).toEqual([sources[1]]);
  });

  it("matches all alternatives or selected alternative ids", () => {
    const sources = [source("OTHER_PLATFORM", "epic"), source("OTHER_PLATFORM", "gog")];

    expect(matchSourceTune({ steam: false, rom: false, allAlternatives: true, alternativeSourceIds: [] }, sources)).toEqual(sources);
    expect(matchSourceTune({ steam: false, rom: false, allAlternatives: false, alternativeSourceIds: ["gog"] }, sources)).toEqual([sources[1]]);
  });

  it("returns no matches for empty selections or no availability rows", () => {
    const tune = { steam: false, rom: false, allAlternatives: false, alternativeSourceIds: [] };
    expect(matchSourceTune(tune, [source("STEAM")])).toEqual([]);
    expect(matchSourceTune({ ...tune, steam: true }, [])).toEqual([]);
  });
});

describe("applySourceTune", () => {
  it("adds one factor with every matched source name and keeps non-matches", () => {
    const pool = [
      { id: "matched", score: 10, positive: [], negative: [], sources: [source("STEAM"), source("OTHER_PLATFORM", "epic")] },
      { id: "plain", score: 20, positive: [], negative: [], sources: [source("ROM")] },
    ];

    const result = applySourceTune(pool, { steam: true, rom: false, allAlternatives: false, alternativeSourceIds: ["epic"] }, new Map([["epic", "Epic Games Store"]]));

    const matched = result.find((item) => item.id === "matched");
    const plain = result.find((item) => item.id === "plain");
    expect(matched).toMatchObject({ id: "matched", score: 13 });
    expect(matched?.positive).toEqual([{
      factor: "source_tune",
      label: "Matches your source tune: Steam, Epic Games Store",
      points: 3,
      sourceNames: ["Steam", "Epic Games Store"],
    }]);
    expect(plain).toMatchObject({ id: "plain", score: 20, positive: [] });
  });
});
