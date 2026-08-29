import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  applySourceTune,
  countTuneMatches,
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
  rawgId: 10,
  experience: "COUCH_GAMING",
  playtimeHours: 4,
  releaseDate: "2020-01-01",
  genres: ["Puzzle"],
  tags: ["Co-op"],
  esrbRating: { name: "Everyone 10+" },
  seriesGames: [],
  ...overrides,
});

describe("matchTuneCriteria", () => {
  it("matches experience, duration, era, genres, tags, and casual maturity", () => {
    const match = matchTuneCriteria({ ...emptyTune, experience: "COUCH_GAMING", length: "SHORT", era: "Y2020_PLUS", genres: ["Puzzle"], tags: ["Co-op"], maturity: "CASUAL" }, candidate());
    expect(match).toEqual({ points: 10, criteria: ["experience", "length", "genre", "tag", "era", "maturity"] });
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
    const seriesGames = [{ rawgId: 11, name: "Later", slug: "later", released: "2021-01-01" }];
    expect(matchTuneCriteria(tune, candidate({ seriesGames })).criteria).toContain("sequelPosture");
    expect(matchTuneCriteria(tune, candidate({ releaseDate: null, seriesGames })).criteria).toEqual([]);
  });

  it("treats missing v1 series data as standalone", () => {
    const tune = { ...emptyTune, sequelPosture: "STANDALONE" as const };
    expect(matchTuneCriteria(tune, candidate({ seriesGames: undefined })).criteria).toContain("sequelPosture");
    expect(matchTuneCriteria(tune, candidate({ seriesGames: [{ rawgId: 11, name: "Later", slug: "later", released: "2021-01-01" }] })).criteria).toEqual([]);
  });

  it("caps the bonus at ten points and gives zero to a zero-criteria tune", () => {
    const allCriteria = { ...emptyTune, experience: "COUCH_GAMING" as const, length: "SHORT" as const, genres: ["Puzzle"], tags: ["Co-op"], era: "Y2020_PLUS" as const, maturity: "CASUAL" as const };
    expect(matchTuneCriteria(allCriteria, candidate()).points).toBe(10);
    expect(matchTuneCriteria(emptyTune, candidate()).points).toBe(0);
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
