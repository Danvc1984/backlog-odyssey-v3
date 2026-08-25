"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { parseSteamAppIdInput } from "@/lib/steam-identity";

const setCatalogSteamAppIdSchema = z
  .object({
    gameId: z.string().trim().min(1),
    identityInput: z.string().trim().min(1).max(500),
  })
  .strict();

export async function setCatalogSteamAppId(input: unknown) {
  try {
    await requireUser();
    const parsed = setCatalogSteamAppIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const appId = parseSteamAppIdInput(parsed.data.identityInput);
    if (!appId.ok) {
      return { success: false as const, data: null, error: appId.reason };
    }

    const game = await prisma.game.findUnique({
      where: { id: parsed.data.gameId },
      select: {
        id: true,
        externalIds: {
          where: { namespace: "STEAM_APP" },
          select: { externalId: true },
        },
      },
    });
    if (!game) {
      return { success: false as const, data: null, error: "Game not found" };
    }
    if (game.externalIds[0]) {
      return {
        success: false as const,
        data: null,
        error: `This game already has Steam App ${game.externalIds[0].externalId}`,
      };
    }

    const conflict = await prisma.externalGameId.findUnique({
      where: {
        namespace_externalId: { namespace: "STEAM_APP", externalId: appId.appId },
      },
      select: { game: { select: { name: true } } },
    });
    if (conflict) {
      return {
        success: false as const,
        data: null,
        error: `Steam App ${appId.appId} is already attached to "${conflict.game.name}"`,
      };
    }

    const identity = await prisma.externalGameId.create({
      data: {
        namespaceId: appId.appId,
        namespace: "STEAM_APP",
        externalId: appId.appId,
        matchMethod: "EXACT_STEAM_APP_ID",
        gameId: game.id,
      },
    });

    return { success: true as const, data: identity, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to save Steam identity",
    };
  }
}
