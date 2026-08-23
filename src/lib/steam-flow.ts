import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type SteamFlowDbClient = typeof prisma | Prisma.TransactionClient;

// Both callers must keep writing the identical PENDING reset until a source
// deliberately diverges its reappear rules.
export async function upsertUnresolvedSteamDlc(
  client: SteamFlowDbClient,
  externalId: string,
  game: { name: string; steamBaseAppId?: string },
): Promise<void> {
  await client.unresolvedSteamDlc.upsert({
    where: { steamAppId: externalId },
    create: {
      steamAppId: externalId,
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
