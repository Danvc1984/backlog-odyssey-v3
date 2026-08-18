"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { normalizeName } from "@/lib/duplicate-utils";

interface GameName {
  id: string;
  name: string;
}

interface DuplicatePair {
  gameAId: string;
  gameBId: string;
  normalizedName: string;
}

function orderedPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

function collectDuplicatePairs(games: GameName[]): DuplicatePair[] {
  const groups = new Map<string, GameName[]>();

  for (const game of games) {
    const normalizedName = normalizeName(game.name);
    const group = groups.get(normalizedName) ?? [];
    group.push(game);
    groups.set(normalizedName, group);
  }

  return [...groups.entries()].flatMap(([normalizedName, group]) => {
    if (group.length < 2) return [];

    const pairs: DuplicatePair[] = [];
    for (let index = 0; index < group.length - 1; index += 1) {
      for (let nextIndex = index + 1; nextIndex < group.length; nextIndex += 1) {
        const [gameAId, gameBId] = orderedPair(
          group[index].id,
          group[nextIndex].id,
        );
        pairs.push({ gameAId, gameBId, normalizedName });
      }
    }
    return pairs;
  });
}

export async function detectDuplicates() {
  try {
    await requireUser();

    const games = await prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
    });
    const candidates = collectDuplicatePairs(games);

    if (candidates.length === 0) {
      return {
        success: true as const,
        data: { scanned: games.length, duplicatesFound: 0 },
        error: null,
      };
    }

    const existing = await prisma.possibleDuplicate.findMany({
      where: {
        OR: candidates.map(({ gameAId, gameBId }) => ({ gameAId, gameBId })),
      },
      select: { gameAId: true, gameBId: true },
    });
    const existingKeys = new Set(
      existing.map(({ gameAId, gameBId }) => `${gameAId}:${gameBId}`),
    );
    const newPairs = candidates.filter(
      ({ gameAId, gameBId }) => !existingKeys.has(`${gameAId}:${gameBId}`),
    );

    const result =
      newPairs.length === 0
        ? { count: 0 }
        : await prisma.possibleDuplicate.createMany({
            data: newPairs.map(({ gameAId, gameBId, normalizedName }) => ({
              gameAId,
              gameBId,
              confidence: 1.0,
              evidence: { method: "name_match", normalizedName },
            })),
          });

    return {
      success: true as const,
      data: { scanned: games.length, duplicatesFound: result.count },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to detect duplicates",
    };
  }
}

export async function dismissDuplicate(duplicateId: string) {
  try {
    await requireUser();
    if (typeof duplicateId !== "string" || duplicateId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const duplicate = await prisma.possibleDuplicate.findUnique({
      where: { id: duplicateId },
      select: { id: true, status: true },
    });
    if (!duplicate) {
      return { success: false as const, data: null, error: "Duplicate not found" };
    }
    if (duplicate.status !== "OPEN") {
      return {
        success: false as const,
        data: null,
        error: "Duplicate has already been dismissed",
      };
    }

    await prisma.possibleDuplicate.update({
      where: { id: duplicateId },
      data: { status: "DISMISSED", reviewedAt: new Date() },
    });

    return { success: true as const, data: { id: duplicateId }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to dismiss duplicate",
    };
  }
}
