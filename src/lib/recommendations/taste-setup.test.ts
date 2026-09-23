import { describe, expect, it, vi } from "vitest";
import {
  loadPickableTasteSetupGames,
  hasCompletedTasteSetup,
  selectRandomTasteSetupPicks,
  selectRandomUnselectedItem,
  selectReplacementTasteSetupPick,
  selectInitialTasteSetupPicks,
  shouldShowTasteSetup,
  tasteSetupGameSelect,
} from "./taste-setup";

function game(id: string, importAt: string, overrides: Partial<{ type: "BASE_GAME" | "DLC"; hidden: boolean; isMainGame: boolean }> = {}) {
  return {
    id,
    name: id,
    type: overrides.type ?? "BASE_GAME",
    importAt: new Date(importAt),
    libraryEntry: {
      hidden: overrides.hidden ?? false,
      isMainGame: overrides.isMainGame ?? false,
      completedBefore: false,
    },
  };
}

describe("taste setup helpers", () => {
  it("queries only visible, non-main owned base games", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await loadPickableTasteSetupGames({ game: { findMany } } as never);

    expect(findMany).toHaveBeenCalledWith({
      where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false, isMainGame: false } } },
      orderBy: { importAt: "desc" },
      select: tasteSetupGameSelect,
    });
  });

  it("samples unique games, caps at six, and keeps the random seam testable", () => {
    const games = Array.from({ length: 8 }, (_, index) =>
      game(`game-${index + 1}`, `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );

    expect(selectInitialTasteSetupPicks(games, () => 0).map((pick) => pick.id)).toEqual([
      "game-1", "game-2", "game-3", "game-4", "game-5", "game-6",
    ]);
    expect(selectInitialTasteSetupPicks(games.slice(0, 3), () => 0).map((pick) => pick.id)).toEqual([
      "game-1", "game-2", "game-3",
    ]);
  });

  it("preserves source order for equal timestamps instead of naming tie-breaks", () => {
    const games = [
      game("zeta", "2026-01-01T00:00:00.000Z"),
      game("alpha", "2026-01-01T00:00:00.000Z"),
    ];

    expect(selectInitialTasteSetupPicks(games, () => 0).map((pick) => pick.id)).toEqual(["zeta", "alpha"]);
  });

  it("replaces from unused eligible games without duplicates", () => {
    const games = Array.from({ length: 4 }, (_, index) => game(`game-${index + 1}`, `2026-01-0${index + 1}T00:00:00.000Z`));
    games[3]!.libraryEntry.completedBefore = true;
    const selected = new Set(["game-1", "game-2", "game-3"]);
    expect(selectReplacementTasteSetupPick(games, selected, () => 0)?.id).toBe("game-4");
    expect(selectRandomUnselectedItem(games, selected, () => 0.99)).toMatchObject({
      id: "game-4",
      libraryEntry: { completedBefore: true },
    });
    expect(selectRandomTasteSetupPicks(games, () => 0).map((pick) => pick.id)).toHaveLength(4);
  });

  it("requires ten library games and a meaningful saved signal", () => {
    expect(shouldShowTasteSetup(false, 10)).toBe(true);
    expect(shouldShowTasteSetup(false, 9)).toBe(false);
    expect(shouldShowTasteSetup(true, 10)).toBe(false);
    expect(hasCompletedTasteSetup([{ payload: { completedBefore: false, recommendMore: false, playSoon: false } }])).toBe(false);
    expect(hasCompletedTasteSetup([{ payload: { completedBefore: false, recommendMore: true, playSoon: false } }])).toBe(true);
  });
});
