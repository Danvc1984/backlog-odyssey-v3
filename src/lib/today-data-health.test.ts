import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  computeActiveBacklogProgress,
  computeProfileCoverage,
  computeRawgCoverage,
  loadTodayDataHealth,
  type TodayDataHealthGameRow,
} from "./today-data-health";

function row(overrides: Partial<TodayDataHealthGameRow> = {}): TodayDataHealthGameRow {
  return {
    id: "game-1",
    libraryEntry: {
      playState: "NOT_STARTED",
      interest: 3,
      priority: "NONE",
      preferredEnvironment: null,
      gameExperience: null,
    },
    metadataSnapshots: [],
    ...overrides,
  };
}

describe("computeActiveBacklogProgress", () => {
  it("excludes abandoned games from both the numerator and the denominator", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "ABANDONED", interest: 3, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ started: 1, total: 1 });
  });

  it("computes started over total across the three non-abandoned play states", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", libraryEntry: { playState: "IN_PROGRESS", interest: null, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
      row({ id: "c", libraryEntry: { playState: "PLAYED_BEFORE", interest: null, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
      row({ id: "d", libraryEntry: { playState: "ABANDONED", interest: null, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
    ];
    expect(computeActiveBacklogProgress(rows)).toEqual({ started: 2, total: 3 });
  });

  it("returns zero totals for an empty universe", () => {
    expect(computeActiveBacklogProgress([])).toEqual({ started: 0, total: 0 });
  });
});

describe("computeRawgCoverage", () => {
  it("counts games with a RAWG metadata snapshot over the full universe", () => {
    const rows = [
      row({ id: "a", metadataSnapshots: [{ id: "snap-1" }] }),
      row({ id: "b" }),
    ];
    expect(computeRawgCoverage(rows)).toEqual({ covered: 1, total: 2 });
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
          preferredEnvironment: "BAZZITE",
          gameExperience: "PC_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1 });
  });

  it("is incomplete when interest is present but all three companions are absent", () => {
    const rows = [row({ id: "a" })];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 1 });
  });

  it("is complete through non-NONE priority alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "LOW",
          preferredEnvironment: null,
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1 });
  });

  it("is complete through preferred environment alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "NONE",
          preferredEnvironment: "WINDOWS",
          gameExperience: null,
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1 });
  });

  it("is complete through game experience alone", () => {
    const rows = [
      row({
        id: "a",
        libraryEntry: {
          playState: "NOT_STARTED",
          interest: 4,
          priority: "NONE",
          preferredEnvironment: null,
          gameExperience: "COUCH_GAMING",
        },
      }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 1 });
  });

  it("counts NONE priority and rating as contributing nothing", () => {
    const rows = [
      row({ id: "a", libraryEntry: { playState: "IN_PROGRESS", interest: 5, priority: "NONE", preferredEnvironment: null, gameExperience: null } }),
      row({ id: "b", libraryEntry: { playState: "PLAYED_BEFORE", interest: null, priority: "HIGH", preferredEnvironment: null, gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 0, total: 2 });
  });

  it("counts every visible game in the denominator even when incomplete", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", libraryEntry: { playState: "NOT_STARTED", interest: 4, priority: "MEDIUM", preferredEnvironment: null, gameExperience: null } }),
    ];
    expect(computeProfileCoverage(rows)).toEqual({ complete: 1, total: 2 });
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
          preferredEnvironment: null,
          gameExperience: null,
        },
        metadataSnapshots: [{ id: "snap-1" }],
      }),
      row({ id: "incomplete" }),
      row({
        id: "abandoned",
        libraryEntry: {
          playState: "ABANDONED",
          interest: 3,
          priority: "NONE",
          preferredEnvironment: null,
          gameExperience: null,
        },
      }),
    ]);

    const health = await loadTodayDataHealth({ game: { findMany: gameFindMany } } as never);

    expect(gameFindMany).toHaveBeenCalledWith({
      where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
      select: {
        id: true,
        libraryEntry: {
          select: {
            playState: true,
            interest: true,
            priority: true,
            preferredEnvironment: true,
            gameExperience: true,
          },
        },
        metadataSnapshots: {
          where: { provider: "RAWG" },
          select: { id: true },
        },
      },
    });
    expect(health).toEqual({
      activeBacklog: { started: 1, total: 2 },
      rawgMetadata: { covered: 1, total: 3 },
      recommendationProfile: { complete: 1, total: 3 },
    });
  });
});