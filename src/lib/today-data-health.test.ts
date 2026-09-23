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
      priority: "NONE",
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
        row({ libraryEntry: { playState: "COMPLETED", interest: 3, priority: "NONE", gameExperience: null } }),
      ]),
    ).toEqual({ completed: 1, inProgress: 0, notStarted: 0, total: 1 });
  });

  it("excludes abandoned games from both the numerator and the denominator", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "ABANDONED", interest: 3, priority: "NONE", gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, priority: "NONE", gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ completed: 0, inProgress: 1, notStarted: 0, total: 1 });
    expect(computeAbandonedCount(rows)).toBe(1);
  });

  it("computes started over total across the three non-abandoned play states", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, priority: "NONE", gameExperience: null } }),
      row({ id: "c", libraryEntry: { playState: "COMPLETED", interest: null, priority: "NONE", gameExperience: null } }),
      row({ id: "d", libraryEntry: { playState: "ABANDONED", interest: null, priority: "NONE", gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ completed: 1, inProgress: 1, notStarted: 1, total: 3 });
  });

  it("does not count prior-only history as current progress", () => {
    expect(
      computeActiveBacklogProgress([
        row({ libraryEntry: { playState: "NOT_STARTED", completedBefore: true, interest: 3, priority: "NONE", gameExperience: null } }),
        row({ libraryEntry: { playState: "COMPLETED", completedBefore: true, interest: 3, priority: "NONE", gameExperience: null } }),
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
          priority: "HIGH",
          gameExperience: "PC_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("is incomplete when interest is present but all three companions are absent", () => {
    const rows = [row({ id: "a" })];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("is complete through non-NONE priority alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "LOW",
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1, incomplete: [] });
  });

  it("is incomplete when only a preferred environment would have been present", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "NONE",
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("is complete through game experience alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "NONE",
          gameExperience: "COUCH_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1, incomplete: [] });
  });

  it("counts NONE priority and rating as contributing nothing", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "IN_PROGRESS", interest: 5, priority: "NONE", gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "COMPLETED", interest: null, priority: "HIGH", gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 2, incomplete: [{ id: "a", name: "Game 1" }, { id: "b", name: "Game 1" }] });
  });

  it("counts every visible game in the denominator even when incomplete", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", libraryEntry: { playState: "NOT_STARTED", interest: 4, priority: "MEDIUM", gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 2, incomplete: [{ id: "a", name: "Game 1" }] });
  });

  it("returns incomplete titles in case-insensitive name order", () => {
    const rows = [
      row({ id: "z", name: "Zelda" }),
      row({ id: "a", name: "alpha" }),
      row({ id: "m", name: "Metroid" }),
      row({
        id: "complete",
        name: "Complete",
          libraryEntry: { playState: "NOT_STARTED", interest: 4, priority: "HIGH", gameExperience: null },
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
          priority: "MEDIUM",
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
          priority: "NONE",
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
            priority: true,
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
        complete: 1,
        total: 3,
        incomplete: [{ id: "incomplete", name: "Alpha" }, { id: "abandoned", name: "Zeta" }],
      },
    });
  });
});
