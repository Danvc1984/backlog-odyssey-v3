"use server";

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import { lastPlayedDate } from "@/lib/steam-utils";
import { upsertUnresolvedSteamDlc, requireSteamFlowContext } from "@/lib/steam-flow";

interface SyncCounts {
  synced: number;
  skipped: number;
  failed: number;
}

function emptyCounts(): SyncCounts {
  return { synced: 0, skipped: 0, failed: 0 };
}

function jsonCounts(counts: SyncCounts): Record<string, number> {
  return { synced: counts.synced, skipped: counts.skipped, failed: counts.failed };
}

const SYNC_CHUNK_SIZE = 50;

async function createSyncRun(): Promise<{ id: string }> {
  return prisma.syncRun.create({
    data: { provider: "STEAM", status: "RUNNING", counts: jsonCounts(emptyCounts()) },
    select: { id: true },
  });
}

export async function syncSteamPlaytime() {
  let syncRunId: string | null = null;

  try {
    await requireUser();

    const context = await requireSteamFlowContext();
    if (!context.ok) {
      return {
        success: false as const,
        data: null,
        error: context.error,
      };
    }

    const games = await fetchOwnedGames(context.steamId64, context.apiKey);

    if (games.length === 0) {
      const syncRun = await createSyncRun();
      syncRunId = syncRun.id;
      const counts = { ...emptyCounts(), failed: 1 };
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          counts: jsonCounts(counts),
          diagnostics: { error: "Steam API returned no owned games" },
        },
      });
      return { success: false as const, data: null, error: "Steam API returned no owned games" };
    }

    const identities = new Map<string, string>();
    const appIds = [...new Set(games.map((game) => String(game.appid)))];
    const knownRows = await prisma.externalGameId.findMany({
      where: { namespace: "STEAM_APP", externalId: { in: appIds } },
      select: { externalId: true, gameId: true },
    });
    for (const row of knownRows) {
      identities.set(row.externalId, row.gameId);
    }

    const syncRun = await createSyncRun();
    syncRunId = syncRun.id;

    const result = emptyCounts();

    for (let index = 0; index < games.length; index += SYNC_CHUNK_SIZE) {
      const chunk = games.slice(index, index + SYNC_CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const game of chunk) {
          const gameId = identities.get(String(game.appid));

          if (!gameId) {
            if (game.type === "DLC") {
              await upsertUnresolvedSteamDlc(tx, String(game.appid), game);
            }
            result.skipped += 1;
            continue;
          }

          const updated = await tx.gameAvailability.updateMany({
            where: { gameId, source: "STEAM" },
            data: {
              steamPlaytimeTotal: BigInt(game.playtimeForever),
              steamLastPlayed: lastPlayedDate(game.rtimeLastPlayed),
            },
          });

          if (updated.count === 0) {
            result.failed += 1;
          } else {
            result.synced += 1;
          }
        }
      });
    }

    const status = result.failed > 0 ? "PARTIAL" : "SUCCESS";
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status, finishedAt: new Date(), counts: jsonCounts(result) },
    });

    return { success: true as const, data: result, error: null };
  } catch (err) {
    if (syncRunId) {
      try {
        await prisma.syncRun.update({
          where: { id: syncRunId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            counts: jsonCounts({ ...emptyCounts(), failed: 1 }),
            diagnostics: {
              error: err instanceof Error ? err.message : "Failed to sync Steam playtime",
            },
          },
        });
      } catch {
        // The transaction may have rolled back the run before recovery executes.
      }
    }

    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to sync Steam playtime",
    };
  }
}
