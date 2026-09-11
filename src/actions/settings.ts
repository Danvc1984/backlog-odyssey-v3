"use server";

import { Prisma } from "@/generated/prisma/client";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { synthesizeCompatibility } from "@/lib/compat-synthesis";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { osSetupSchema } from "@/lib/os-setup";
import { runRecommendationPipeline } from "@/lib/recommendations/run-pipeline";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const durationProfileSchema = z.enum(["HASTILY", "NORMALLY", "COMPLETELY"]);

function rowsFromSnapshots(
  name: string,
  steamAppId: string | null,
  snapshots: Array<{ provider: string; result: unknown }>,
) {
  const protonDbSnapshot = snapshots.find((snapshot) => snapshot.provider === "PROTONDB");
  const awaySnapshot = snapshots.find((snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET");
  const protonDb = steamAppId && protonDbSnapshot
    ? parseProtonDbSummary(steamAppId, protonDbSnapshot.result)
    : null;
  const away = parseAntiCheatEvidence(awaySnapshot?.result);

  return synthesizeCompatibility({
    protonDb,
    away: away ? { appId: steamAppId ?? "", name, status: away.status, anticheats: away.anticheats } : null,
    game: { name, hasSteamAppId: Boolean(steamAppId) },
  });
}

async function rederiveCatalogCompatibility(tx: Prisma.TransactionClient): Promise<number> {
  const games = await tx.game.findMany({
    where: { type: "BASE_GAME" },
    select: {
      id: true,
      name: true,
      externalIds: { where: { namespace: "STEAM_APP" }, select: { externalId: true }, take: 1 },
      compatSnapshots: { select: { provider: true, result: true } },
    },
  });

  for (const game of games) {
    const rows = rowsFromSnapshots(game.name, game.externalIds[0]?.externalId ?? null, game.compatSnapshots);
    for (const row of rows) {
      await tx.environmentCompatibility.upsert({
        where: { gameId_environment: { gameId: game.id, environment: row.environment } },
        create: { gameId: game.id, environment: row.environment, status: row.status, source: row.source },
        update: { status: row.status, source: row.source },
      });
    }
  }
  return games.length;
}

async function rederiveWishlistCompatibility(tx: Prisma.TransactionClient): Promise<number> {
  const entries = await tx.wishlistEntry.findMany({
    select: {
      id: true,
      name: true,
      steamAppId: true,
      compatSnapshots: { select: { provider: true, result: true } },
    },
  });

  for (const entry of entries) {
    const rows = rowsFromSnapshots(entry.name, entry.steamAppId, entry.compatSnapshots);
    for (const row of rows) {
      await tx.wishlistEnvironmentCompatibility.upsert({
        where: { wishlistEntryId_environment: { wishlistEntryId: entry.id, environment: row.environment } },
        create: { wishlistEntryId: entry.id, environment: row.environment, status: row.status, source: row.source },
        update: { status: row.status, source: row.source },
      });
    }
  }
  return entries.length;
}

export async function updateOsSetup(input: unknown) {
  try {
    await requireUser();
    const parsed = osSetupSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid OS setup" };

    const data = await prisma.$transaction(async (tx) => {
      const settings = await tx.appSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...parsed.data },
        update: parsed.data,
      });
      const catalogGames = await rederiveCatalogCompatibility(tx);
      const wishlistEntries = await rederiveWishlistCompatibility(tx);
      const recommendations = await runRecommendationPipeline(tx);
      return { settings, catalogGames, wishlistEntries, recommendations };
    });

    return { success: true as const, data, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to update OS setup"),
    };
  }
}

export async function updateDurationProfile(input: unknown) {
  try {
    await requireUser();
    const parsed = durationProfileSchema.safeParse(
      typeof input === "object" && input !== null && "durationProfile" in input
        ? input.durationProfile
        : undefined,
    );
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid duration profile" };
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, durationProfile: parsed.data },
      update: { durationProfile: parsed.data },
    });
    return { success: true as const, data: settings, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to update duration profile") };
  }
}
