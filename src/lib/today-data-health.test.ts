import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  computeActiveBacklogProgress,
  computeAbandonedCount,
  computeProfileCoverage,
  computeIgdbCoverage,
  loadTodayDataHealth,
  type TodayDataHealthGameRow,
} from "./today-data-health";

function row(overrides: Partial<TodayDataHealthGameRow> = {}): TodayDataHealthGameRow {
  return {
    id: "game-1",
    name: "Game 1",
    libraryEntry: {
      playState: "NOT_STARTED",
      interest: 3,
      gameExperience: null,
    },
    metadataSnapshots: [],
    ...overrides,
  };
}

describe("computeActiveBacklogProgress", () => {
  it("counts a currently completed game in the completed numerator", () => {
    expect(
      computeActiveBacklogProgress([
        row({ libraryEntry: { playState: "COMPLETED", interest: 3, gameExperience: null } }),
      ]),
    ).toEqual({ completed: 1, inProgress: 0, notStarted: 0, total: 1 });
  });

  it("excludes abandoned games from both the numerator and the denominator", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "ABANDONED", interest: 3, gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ completed: 0, inProgress: 1, notStarted: 0, total: 1 });
    expect(computeAbandonedCount(rows)).toBe(1);
  });

  it("computes started over total across the three non-abandoned play states", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, gameExperience: null } }),
      row({ id: "c", libraryEntry: { playState: "COMPLETED", interest: null, gameExperience: null } }),
      row({ id: "d", libraryEntry: { playState: "ABANDONED", interest: null, gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ completed: 1, inProgress: 1, notStarted: 1, total: 3 });
  });

  it("does not count prior-only history as current progress", () => {
    expect(
      computeActiveBacklogProgress([
        row({ libraryEntry: { playState: "NOT_STARTED", completedBefore: true, interest: 3, gameExperience: null } }),
        row({ libraryEntry: { playState: "COMPLETED", completedBefore: true, interest: 3, gameExperience: null } }),
      ]),
    ).toEqual({ completed: 1, inProgress: 0, notStarted: 1, total: 2 });
  });

  it("returns zero totals for an empty universe", () => {
    expect(computeActiveBacklogProgress([])).toEqual({ completed: 0, inProgress: 0, notStarted: 0, total: 0 });
  });
});

describe("computeIgdbCoverage", () => {
  it("counts games with an IGDB metadata snapshot over the full universe", () => {
    const rows = [
      row({ id: "a", metadataSnapshots: [{ id: "snap-1" }] }),
      row({ id: "b" }),
    ];
    expect(computeIgdbCoverage(rows)).toEqual({
      covered: 1,
      total: 2,
      missing: [{ id: "b", name: "Game 1" }],
    });
  });

  it("returns missing titles in case-insensitive name order", () => {
    const rows = [
      row({ id: "z", name: "Zelda" }),
      row({ id: "a", name: "alpha" }),
      row({ id: "m", name: "Metroid" }),
      row({ id: "covered", name: "Covered", metadataSnapshots: [{ id: "snap-1" }] }),
    ];
    expect(computeIgdbCoverage(rows).missing).toEqual([
      { id: "a", name: "alpha" },
      { id: "m", name: "Metroid" },
      { id: "z", name: "Zelda" },
    ]);
  });
});

describe("computeProfileCoverage", () => {
  it("is incomplete without interest", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: null,
          gameExperience: "PC_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("is complete when Play priority is set without companions", () => {
    const rows = [row({ id: "a" })];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1, incomplete: [] });
  });

  it("is complete through Play priority alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1, incomplete: [] });
  });

  it("is incomplete when Play priority is unset", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: null,
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("is incomplete through game experience alone when Play priority is unset", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: null,
          gameExperience: "COUCH_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("counts unset Play priority as incomplete regardless of rating", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "IN_PROGRESS", interest: 5, gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "COMPLETED", interest: null, gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 2, incomplete: [{ id: "b", name: "Game 1" }] });
  });

  it("counts every visible game and requires Play priority", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "NOT_STARTED", interest: null, gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "NOT_STARTED", interest: 4, gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 2, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("returns incomplete titles in case-insensitive name order", () => {
    const rows = [
      row({ id: "z", name: "Zelda", libraryEntry: { playState: "NOT_STARTED", interest: null, gameExperience: null } }),
      row({ id: "a", name: "alpha", libraryEntry: { playState: "NOT_STARTED", interest: null, gameExperience: null } }),
      row({ id: "m", name: "Metroid", libraryEntry: { playState: "NOT_STARTED", interest: null, gameExperience: null } }),
      row({
        id: "complete",
        name: "Complete",
          libraryEntry: { playState: "NOT_STARTED", interest: 4, gameExperience: null },
      }),
    ];
    expect(computeProfileCoverage(rows).incomplete).toEqual([
      { id: "a", name: "alpha" },
      { id: "m", name: "Metroid" },
      { id: "z", name: "Zelda" },
    ]);
  });
});

describe("loadTodayDataHealth", () => {
  it("queries only visible base games and composes the three counts", async () => {
    const gameFindMany = vi.fn().mockResolvedValue([
      row({
        id: "complete",
        libraryEntry: {
          playState: "IN_PROGRESS",
          interest: 4,
          gameExperience: null,
        },
        metadataSnapshots: [{ id: "snap-1" }],
      }),
      row({ id: "incomplete", name: "Alpha" }),
      row({
        id: "abandoned",
        name: "Zeta",
        libraryEntry: {
          playState: "ABANDONED",
          interest: 3,
          gameExperience: null,
        },
      }),
    ]);

    const health = await loadTodayDataHealth({ game: { findMany: gameFindMany } } as never);

    expect(gameFindMany).toHaveBeenCalledWith({
      where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
      select: {
        id: true,
        name: true,
        libraryEntry: {
          select: {
            playState: true,
            completedBefore: true,
            interest: true,
            gameExperience: true,
          },
        },
        metadataSnapshots: {
          where: { provider: "IGDB" },
          select: { id: true },
        },
      },
    });
    expect(health).toEqual({
      activeBacklog: { completed: 0, inProgress: 1, notStarted: 1, total: 2 },
      abandoned: 1,
      igdbMetadata: {
        covered: 1,
        total: 3,
        missing: [{ id: "incomplete", name: "Alpha" }, { id: "abandoned", name: "Zeta" }],
      },
      recommendationProfile: {
        complete: 3,
        total: 3,
        incomplete: [],
      },
    });
  });
});
