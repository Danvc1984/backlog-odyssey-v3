import type { Prisma } from "@/generated/prisma/client";

export const TASTE_SETUP_MAX_PICKS = 6;

export const tasteSetupGameSelect = {
  id: true,
  name: true,
  type: true,
  importAt: true,
  libraryEntry: { select: { hidden: true, isMainGame: true } },
} as const;

export type TasteSetupGameRow = Prisma.GameGetPayload<{ select: typeof tasteSetupGameSelect }>;

export interface TasteSetupPick {
  id: string;
  name: string;
  addedAt: Date;
}

export async function loadPickableTasteSetupGames(
  client: Pick<Prisma.TransactionClient, "game">,
): Promise<TasteSetupGameRow[]> {
  return client.game.findMany({
    where: {
      type: "BASE_GAME",
      libraryEntry: { is: { hidden: false, isMainGame: false } },
    },
    orderBy: { importAt: "desc" },
    select: tasteSetupGameSelect,
  });
}

export function selectInitialTasteSetupPicks(
  games: readonly TasteSetupGameRow[],
): TasteSetupPick[] {
  return games
    .map((game, index) => ({ game, index }))
    .sort((left, right) => right.game.importAt.getTime() - left.game.importAt.getTime() || left.index - right.index)
    .slice(0, TASTE_SETUP_MAX_PICKS)
    .map(({ game }) => ({ id: game.id, name: game.name, addedAt: game.importAt }));
}

export function shouldShowTasteSetup(eventCount: number, pickableCount: number): boolean {
  return eventCount === 0 && pickableCount > 0;
}
