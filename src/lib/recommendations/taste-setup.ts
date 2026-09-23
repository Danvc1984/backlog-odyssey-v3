import type { Prisma } from "@/generated/prisma/client";

export const TASTE_SETUP_MAX_PICKS = 6;
export const TASTE_SETUP_MIN_LIBRARY_GAMES = 10;

export const tasteSetupGameSelect = {
  id: true,
  name: true,
  type: true,
  importAt: true,
  libraryEntry: { select: { hidden: true, isMainGame: true, completedBefore: true } },
} as const;

export type TasteSetupGameRow = Prisma.GameGetPayload<{ select: typeof tasteSetupGameSelect }>;

export interface TasteSetupPick {
  id: string;
  name: string;
  addedAt: Date;
  completedBefore: boolean;
}

export interface TasteSetupSignal {
  completedBefore: boolean;
  recommendMore: boolean;
  playSoon: boolean;
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
  random: () => number = Math.random,
): TasteSetupPick[] {
  return selectRandomTasteSetupPicks(games, random);
}

export function selectRandomTasteSetupPicks(
  games: readonly TasteSetupGameRow[],
  random: () => number = Math.random,
  limit = TASTE_SETUP_MAX_PICKS,
): TasteSetupPick[] {
  const pool = [...games];
  const count = Math.min(Math.max(0, limit), pool.length);
  for (let index = 0; index < count; index += 1) {
    const normalized = Math.min(0.999999999, Math.max(0, random()));
    const swapIndex = index + Math.floor(normalized * (pool.length - index));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count).map((game) => ({
    id: game.id,
    name: game.name,
    addedAt: game.importAt,
    completedBefore: game.libraryEntry?.completedBefore ?? false,
  }));
}

export function selectReplacementTasteSetupPick(
  games: readonly TasteSetupGameRow[],
  selectedIds: ReadonlySet<string>,
  random: () => number = Math.random,
): TasteSetupPick | null {
  const game = selectRandomUnselectedItem(games, selectedIds, random);
  if (!game) return null;
  return {
    id: game.id,
    name: game.name,
    addedAt: game.importAt,
    completedBefore: game.libraryEntry?.completedBefore ?? false,
  };
}

export function selectRandomUnselectedItem<T extends { id: string }>(
  items: readonly T[],
  selectedIds: ReadonlySet<string>,
  random: () => number = Math.random,
): T | null {
  const unused = items.filter((item) => !selectedIds.has(item.id));
  if (unused.length === 0) return null;
  const normalized = Math.min(0.999999999, Math.max(0, random()));
  return unused[Math.floor(normalized * unused.length)] ?? null;
}

export function hasMeaningfulTasteSetupSignal(signal: Partial<TasteSetupSignal> | null | undefined): boolean {
  return signal?.completedBefore === true || signal?.recommendMore === true || signal?.playSoon === true;
}

export function hasCompletedTasteSetup(
  events: ReadonlyArray<{ payload: unknown }>,
): boolean {
  return events.some((event) => {
    if (typeof event.payload !== "object" || event.payload === null) return false;
    return hasMeaningfulTasteSetupSignal(event.payload as Partial<TasteSetupSignal>);
  });
}

export function shouldShowTasteSetup(completed: boolean, libraryBaseGameCount: number): boolean {
  return !completed && libraryBaseGameCount >= TASTE_SETUP_MIN_LIBRARY_GAMES;
}
