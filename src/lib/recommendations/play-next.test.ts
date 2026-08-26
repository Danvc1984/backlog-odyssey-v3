import { describe, expect, it } from "vitest";

import {
  PLAY_NEXT_LIMIT,
  isEligibleForPlayNext,
  rankPlayNextCandidates,
  scorePlayNextCandidate,
} from "./play-next";
import type { PlayNextCandidate } from "./types";

function candidate(overrides: Partial<PlayNextCandidate> = {}): PlayNextCandidate {
  return {
    id: "game-1",
    name: "Portal 2",
    type: "BASE_GAME",
    libraryEntry: {
      playState: "NOT_STARTED",
      priority: "NONE",
      interest: null,
      playSoon: false,
      replayCandidate: false,
      hidden: false,
      isMainGame: false,
    },
    ...overrides,
  };
}

describe("isEligibleForPlayNext", () => {
  it("includes a plain NOT_STARTED base game with a library entry", () => {
    expect(isEligibleForPlayNext(candidate())).toBe(true);
  });

  it("excludes DLC entries", () => {
    expect(isEligibleForPlayNext(candidate({ type: "DLC" }))).toBe(false);
  });

  it("excludes games without a library entry", () => {
    expect(isEligibleForPlayNext(candidate({ libraryEntry: null }))).toBe(false);
  });

  it("excludes hidden games", () => {
    expect(
      isEligibleForPlayNext(candidate({ libraryEntry: { ...candidate().libraryEntry!, hidden: true } })),
    ).toBe(false);
  });

  it("excludes main games", () => {
    expect(
      isEligibleForPlayNext(
        candidate({ libraryEntry: { ...candidate().libraryEntry!, isMainGame: true } }),
      ),
    ).toBe(false);
  });

  it("excludes IN_PROGRESS regardless of the replay flag", () => {
    const base = candidate().libraryEntry!;
    expect(
      isEligibleForPlayNext(candidate({ libraryEntry: { ...base, playState: "IN_PROGRESS" } })),
    ).toBe(false);
    expect(
      isEligibleForPlayNext(
        candidate({ libraryEntry: { ...base, playState: "IN_PROGRESS", replayCandidate: true } }),
      ),
    ).toBe(false);
  });

  it("excludes PLAYED_BEFORE and ABANDONED without the replay flag", () => {
    const base = candidate().libraryEntry!;
    expect(
      isEligibleForPlayNext(candidate({ libraryEntry: { ...base, playState: "PLAYED_BEFORE" } })),
    ).toBe(false);
    expect(
      isEligibleForPlayNext(candidate({ libraryEntry: { ...base, playState: "ABANDONED" } })),
    ).toBe(false);
  });

  it("includes flagged replay candidates in replayable states", () => {
    const base = candidate().libraryEntry!;
    expect(
      isEligibleForPlayNext(
        candidate({ libraryEntry: { ...base, playState: "PLAYED_BEFORE", replayCandidate: true } }),
      ),
    ).toBe(true);
    expect(
      isEligibleForPlayNext(
        candidate({ libraryEntry: { ...base, playState: "ABANDONED", replayCandidate: true } }),
      ),
    ).toBe(true);
  });
});

describe("scorePlayNextCandidate", () => {
  it("scores interest at ten points per level", () => {
    const scored = scorePlayNextCandidate(
      candidate({ libraryEntry: { ...candidate().libraryEntry!, interest: 4 } }),
    );

    expect(scored.score).toBe(40);
    expect(scored.positive).toEqual([
      { factor: "interest", label: "Interest 4", points: 40 },
    ]);
    expect(scored.negative).toEqual([]);
  });

  it("treats null interest as zero with no factor chip", () => {
    const scored = scorePlayNextCandidate(candidate());

    expect(scored.score).toBe(0);
    expect(scored.positive).toEqual([]);
    expect(scored.negative).toEqual([]);
  });

  it("awards two, four, and six priority points for LOW, MEDIUM, HIGH", () => {
    const base = candidate().libraryEntry!;
    expect(scorePlayNextCandidate(candidate({ libraryEntry: { ...base, priority: "LOW" } })).score).toBe(2);
    expect(scorePlayNextCandidate(candidate({ libraryEntry: { ...base, priority: "MEDIUM" } })).score).toBe(4);
    expect(scorePlayNextCandidate(candidate({ libraryEntry: { ...base, priority: "HIGH" } })).score).toBe(6);

    const noneScored = scorePlayNextCandidate(candidate());
    expect(noneScored.score).toBe(0);
    expect(noneScored.positive).toEqual([]);
  });

  it("adds three points for the play soon flag", () => {
    const scored = scorePlayNextCandidate(
      candidate({ libraryEntry: { ...candidate().libraryEntry!, playSoon: true } }),
    );

    expect(scored.score).toBe(3);
    expect(scored.positive).toEqual([{ factor: "play_soon", label: "Marked play soon", points: 3 }]);
  });

  it("adds two replay points for a flagged replay candidate", () => {
    const scored = scorePlayNextCandidate(
      candidate({
        libraryEntry: {
          ...candidate().libraryEntry!,
          playState: "PLAYED_BEFORE",
          replayCandidate: true,
        },
      }),
    );

    expect(scored.score).toBe(2);
    expect(scored.positive).toEqual([{ factor: "replay", label: "Replay candidate", points: 2 }]);
  });

  it("penalizes an abandoned play state by two points", () => {
    const scored = scorePlayNextCandidate(
      candidate({ libraryEntry: { ...candidate().libraryEntry!, playState: "ABANDONED" } }),
    );

    expect(scored.score).toBe(-2);
    expect(scored.negative).toEqual([
      { factor: "abandoned", label: "Previously abandoned", points: -2 },
    ]);
  });

  it("combines every factor additively", () => {
    const scored = scorePlayNextCandidate(
      candidate({
        libraryEntry: {
          playState: "ABANDONED",
          priority: "HIGH",
          interest: 5,
          playSoon: true,
          replayCandidate: true,
          hidden: false,
          isMainGame: false,
        },
      }),
    );

    expect(scored.score).toBe(50 + 6 + 3 + 2 - 2);
    expect(scored.positive.map((factor) => factor.factor)).toEqual([
      "interest",
      "priority",
      "play_soon",
      "replay",
    ]);
    expect(scored.negative.map((factor) => factor.factor)).toEqual(["abandoned"]);
  });
});

describe("rankPlayNextCandidates", () => {
  it("orders by score descending and keeps the top three", () => {
    const ranked = rankPlayNextCandidates([
      candidate({ id: "low", libraryEntry: { ...candidate().libraryEntry!, interest: 1 } }),
      candidate({ id: "high", libraryEntry: { ...candidate().libraryEntry!, interest: 5 } }),
      candidate({ id: "mid-high", libraryEntry: { ...candidate().libraryEntry!, interest: 4 } }),
      candidate({ id: "mid-low", libraryEntry: { ...candidate().libraryEntry!, interest: 3 } }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["high", "mid-high", "mid-low"]);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(ranked).toHaveLength(PLAY_NEXT_LIMIT);
  });

  it("breaks ties by case-insensitive name ascending, stable for equal names", () => {
    const ranked = rankPlayNextCandidates([
      candidate({ id: "zeta", name: "zeta" }),
      candidate({ id: "alpha-upper", name: "ALPHA" }),
      candidate({ id: "beta", name: "Beta" }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["alpha-upper", "beta", "zeta"]);
    expect(new Set(ranked.map((item) => item.score))).toEqual(new Set([0]));
  });

  it("never surfaces ineligible candidates even when they outscore everyone", () => {
    const ranked = rankPlayNextCandidates([
      candidate({
        id: "main-game-50",
        libraryEntry: { ...candidate().libraryEntry!, interest: 5, isMainGame: true },
      }),
      candidate({ id: "only-eligible" }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["only-eligible"]);
    expect(ranked[0].rank).toBe(1);
  });
});
