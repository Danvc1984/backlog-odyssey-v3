"use server";

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import { lastPlayedDate } from "@/lib/steam-utils";

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

export async function syncSteamPlaytime() {
  let syncRunId: string | null = null;

  try {
    await requireUser();

    const connection = await prisma.steamConnection.findUnique({
      where: { id: 1 },
    });
    if (!connection) {
      return {
        success: false as const,
        data: null,
        error: "Steam account is not connected",
      };
    }

    const apiKey = process.env.STEAM_WEB_API_KEY;
    if (!apiKey) {
      return {
        success: false as const,
        data: null,
        error: "STEAM_WEB_API_KEY is not configured",
      };
    }

    const games = await fetchOwnedGames(connection.steamId64, apiKey);

    const outcome = await prisma.$transaction(async (tx) => {
      const syncRun = await tx.syncRun.create({
        data: { provider: "STEAM", status: "RUNNING", counts: jsonCounts(emptyCounts()) },
      });
      syncRunId = syncRun.id;

      if (games.length === 0) {
        const counts = { ...emptyCounts(), failed: 1 };
        await tx.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            counts: jsonCounts(counts),
            diagnostics: { error: "Steam API returned no owned games" },
          },
        });
        return { success: false as const, counts };
      }

      const result = emptyCounts();

      for (const game of games) {
        const externalId = await tx.externalGameId.findUnique({
          where: {
            namespace_externalId: {
              namespace: "STEAM_APP",
              externalId: String(game.appid),
            },
          },
        });

        if (!externalId) {
          if (game.type === "DLC") {
            await tx.unresolvedSteamDlc.upsert({
              where: { steamAppId: String(game.appid) },
              create: {
                steamAppId: String(game.appid),
                name: game.name,
                steamBaseAppId: game.steamBaseAppId ?? null,
              },
              update: {
                name: game.name,
                steamBaseAppId: game.steamBaseAppId ?? null,
                status: "PENDING",
                discardedAt: null,
              },
            });
          }
          result.skipped += 1;
          continue;
        }

        const updated = await tx.gameAvailability.updateMany({
          where: { gameId: externalId.gameId, source: "STEAM" },
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

      const status = result.failed > 0 ? "PARTIAL" : "SUCCESS";
      await tx.syncRun.update({
        where: { id: syncRun.id },
        data: { status, finishedAt: new Date(), counts: jsonCounts(result) },
      });

      return { success: true as const, counts: result };
    });

    if (!outcome.success) {
      return {
        success: false as const,
        data: outcome.counts,
        error: "Steam API returned no owned games",
      };
    }

    return { success: true as const, data: outcome.counts, error: null };
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
