"use server";

import { prisma } from "@/lib/prisma";
import { friendlyActionError } from "@/lib/action-error";
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

interface ExistingDuplicate {
  id: string;
  status: string;
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

export async function detectDuplicates(input?: { includeDismissed?: boolean }) {
  try {
    await requireUser();
    const includeDismissed = input?.includeDismissed === true;

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
      select: { id: true, gameAId: true, gameBId: true, status: true },
    });
    const existingByKey = new Map<string, ExistingDuplicate>(
      existing.map((row) => [`${row.gameAId}:${row.gameBId}`, { id: row.id, status: row.status }]),
    );

    const newPairs = candidates.filter(
      ({ gameAId, gameBId }) => !existingByKey.has(`${gameAId}:${gameBId}`),
    );
    const dismissedPairs = includeDismissed
      ? candidates.filter(
          ({ gameAId, gameBId }) =>
            existingByKey.get(`${gameAId}:${gameBId}`)?.status === "DISMISSED",
        )
      : [];

    const created =
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

    if (dismissedPairs.length > 0) {
      await Promise.all(
        dismissedPairs.map(({ gameAId, gameBId, normalizedName }) => {
          const existingRow = existingByKey.get(
            `${gameAId}:${gameBId}`,
          ) as ExistingDuplicate;
          return prisma.possibleDuplicate.update({
            where: { id: existingRow.id },
            data: {
              status: "OPEN",
              reviewedAt: null,
              confidence: 1.0,
              evidence: { method: "name_match", normalizedName },
            },
          });
        }),
      );
    }

    return {
      success: true as const,
      data: {
        scanned: games.length,
        duplicatesFound: created.count + dismissedPairs.length,
      },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to detect duplicates"),
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
      error: friendlyActionError(err, "Failed to dismiss duplicate"),
    };
  }
}
