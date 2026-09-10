import "server-only";

import { prisma } from "@/lib/prisma";
import {
  IGDB_EXTERNAL_NAMESPACE,
  type IgdbMatchResult,
  type IgdbMatchMethod,
} from "./igdb-types";

type IgdbTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type IgdbPersistenceResult =
  | { success: true; data: { gameId: string; igdbId: number }; error: null }
  | {
      success: false;
      data: null;
      error: { code: "NOT_MATCHED" | "IGDB_ID_CONFLICT" | "PERSISTENCE_FAILED"; message: string };
    };

class IgdbIdentityConflictError extends Error {
  constructor() {
    super("IGDB game identity is already attached to another catalog game");
    this.name = "IgdbIdentityConflictError";
  }
}

async function persistMatchedIdentity(
  tx: IgdbTransactionClient,
  gameId: string,
  igdbId: number,
  matchMethod: IgdbMatchMethod,
): Promise<void> {
  const externalId = String(igdbId);
  const existing = await tx.externalGameId.findUnique({
    where: {
      namespace_externalId: {
        namespace: IGDB_EXTERNAL_NAMESPACE,
        externalId,
      },
    },
  });

  if (existing && existing.gameId !== gameId) throw new IgdbIdentityConflictError();
  if (existing?.matchMethod === "MANUAL_IGDB_SEARCH" && matchMethod !== "MANUAL_IGDB_SEARCH") return;

  await tx.externalGameId.deleteMany({
    where: { gameId, namespace: IGDB_EXTERNAL_NAMESPACE },
  });
  await tx.externalGameId.create({
    data: {
      namespaceId: externalId,
      namespace: IGDB_EXTERNAL_NAMESPACE,
      externalId,
      matchMethod,
      gameId,
    },
  });
}

export async function persistIgdbIdentity(
  gameId: string,
  result: IgdbMatchResult,
): Promise<IgdbPersistenceResult> {
  if (result.outcome !== "MATCHED") {
    return {
      success: false,
      data: null,
      error: { code: "NOT_MATCHED", message: "Only a matched IGDB result can be persisted" },
    };
  }

  try {
    await prisma.$transaction((tx) =>
      persistMatchedIdentity(tx, gameId, result.game.id, result.matchMethod),
    );
    return { success: true, data: { gameId, igdbId: result.game.id }, error: null };
  } catch (error) {
    const isConflict = error instanceof IgdbIdentityConflictError;
    return {
      success: false,
      data: null,
      error: {
        code: isConflict ? "IGDB_ID_CONFLICT" : "PERSISTENCE_FAILED",
        message: isConflict ? error.message : "IGDB identity could not be saved",
      },
    };
  }
}
