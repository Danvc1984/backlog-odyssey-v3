import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type SteamFlowDbClient = typeof prisma | Prisma.TransactionClient;

// Both callers must keep writing the identical PENDING reset until a source
// deliberately diverges its reappear rules.
export async function upsertUnresolvedSteamDlc(
  client: SteamFlowDbClient,
  externalId: string,
  game: { name: string; steamBaseAppId?: string },
  source?: "OWNED_SYNC" | "WISHLIST_IMPORT",
): Promise<void> {
  const sourceData = source ? { source } : {};

  await client.unresolvedSteamDlc.upsert({
    where: { steamAppId: externalId },
    create: {
      steamAppId: externalId,
      name: game.name,
      steamBaseAppId: game.steamBaseAppId ?? null,
      ...sourceData,
    },
    update: {
      name: game.name,
      steamBaseAppId: game.steamBaseAppId ?? null,
      ...sourceData,
      status: "PENDING",
      discardedAt: null,
    },
  });
}

export async function reconcileWishlistImportDlcs(
  client: SteamFlowDbClient,
  baseSteamAppId: string,
  baseGameId: string,
): Promise<void> {
  const pending = await client.unresolvedSteamDlc.findMany({
    where: {
      steamBaseAppId: baseSteamAppId,
      source: "WISHLIST_IMPORT",
      status: "PENDING",
    },
    select: { steamAppId: true, name: true },
  });

  for (const unresolved of pending) {
    const existing = await client.wishlistEntry.findFirst({
      where: { steamAppId: unresolved.steamAppId },
      select: { id: true },
    });

    if (!existing) {
      await client.wishlistEntry.create({
        data: {
          name: unresolved.name,
          type: "DLC",
          baseGameId,
          interest: 2,
          notes: null,
          steamAppId: unresolved.steamAppId,
          steamAppIdProvenance: "STEAM_IMPORT",
        },
      });
    }

    await client.unresolvedSteamDlc.delete({
      where: { steamAppId: unresolved.steamAppId },
    });
  }
}

export type SteamFlowContext =
  | { ok: true; steamId64: string; apiKey: string }
  | { ok: false; error: string };

export async function requireSteamFlowContext(): Promise<SteamFlowContext> {
  const connection = await prisma.steamConnection.findUnique({
    where: { id: 1 },
  });
  if (!connection) {
    return { ok: false, error: "Steam account is not connected" };
  }
  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "STEAM_WEB_API_KEY is not configured" };
  }
  return { ok: true, steamId64: connection.steamId64, apiKey };
}
