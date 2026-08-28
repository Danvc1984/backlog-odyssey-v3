import { describe, expect, it, vi } from "vitest";
import {
  loadPickableTasteSetupGames,
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

  it("keeps recent games first, caps at six, and lets smaller libraries through", () => {
    const games = Array.from({ length: 8 }, (_, index) =>
      game(`game-${index + 1}`, `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );

    expect(selectInitialTasteSetupPicks(games).map((pick) => pick.id)).toEqual([
      "game-8", "game-7", "game-6", "game-5", "game-4", "game-3",
    ]);
    expect(selectInitialTasteSetupPicks(games.slice(0, 3)).map((pick) => pick.id)).toEqual([
      "game-3", "game-2", "game-1",
    ]);
  });

  it("preserves source order for equal timestamps instead of naming tie-breaks", () => {
    const games = [
      game("zeta", "2026-01-01T00:00:00.000Z"),
      game("alpha", "2026-01-01T00:00:00.000Z"),
    ];

    expect(selectInitialTasteSetupPicks(games).map((pick) => pick.id)).toEqual(["zeta", "alpha"]);
  });

  it("shows only before setup and only when a pickable game exists", () => {
    expect(shouldShowTasteSetup(0, 1)).toBe(true);
    expect(shouldShowTasteSetup(1, 1)).toBe(false);
    expect(shouldShowTasteSetup(0, 0)).toBe(false);
  });
});
