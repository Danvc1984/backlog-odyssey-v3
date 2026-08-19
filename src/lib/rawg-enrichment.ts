import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  RAWG_EXTERNAL_NAMESPACE,
  RAWG_METADATA_SCHEMA_VERSION,
  type RawgGameDetails,
  type RawgMatchMethod,
  type RawgMatchResult,
  type RawgMetadataPayload,
  type RawgPersistenceResult,
} from "./rawg-types";

type RawgTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class RawgIdentityConflictError extends Error {
  constructor() {
    super("RAWG game identity is already attached to another catalog game");
    this.name = "RawgIdentityConflictError";
  }
}

export function toRawgMetadataPayload(
  game: RawgGameDetails,
  fetchedAt: Date,
): RawgMetadataPayload {
  return {
    schemaVersion: RAWG_METADATA_SCHEMA_VERSION,
    rawgId: game.id,
    rawgSlug: game.slug,
    title: game.name,
    description: game.description,
    releaseDate: game.released,
    backgroundImageUrls: [game.backgroundImage, game.backgroundImageAdditional].filter(
      (url): url is string => url !== null,
    ),
    genres: game.genres.map(({ name }) => name),
    tags: game.tags.map(({ name }) => name),
    developers: game.developers.map(({ name }) => name),
    publishers: game.publishers.map(({ name }) => name),
    website: game.website,
    rating: game.rating,
    metacriticScore: game.metacritic,
    playtimeHours: game.playtime,
    alternativeNames: game.alternativeNames,
    rawgUrl: game.rawgUrl,
    attribution: {
      provider: "RAWG",
      sourceUrl: game.rawgUrl,
      fetchedAt: fetchedAt.toISOString(),
    },
  };
}

async function persistMatchedRawgGame(
  tx: RawgTransactionClient,
  gameId: string,
  game: RawgGameDetails,
  matchMethod: RawgMatchMethod,
  fetchedAt: Date,
): Promise<void> {
  const externalId = String(game.id);
  const existingIdentity = await tx.externalGameId.findUnique({
    where: {
      namespace_externalId: {
        namespace: RAWG_EXTERNAL_NAMESPACE,
        externalId,
      },
    },
  });

  if (existingIdentity && existingIdentity.gameId !== gameId) {
    throw new RawgIdentityConflictError();
  }

  await tx.externalGameId.deleteMany({
    where: { gameId, namespace: RAWG_EXTERNAL_NAMESPACE },
  });
  await tx.externalGameId.create({
    data: {
      namespaceId: externalId,
      namespace: RAWG_EXTERNAL_NAMESPACE,
      externalId,
      matchMethod,
      gameId,
    },
  });

  await tx.metadataSnapshot.deleteMany({
    where: { gameId, provider: "RAWG" },
  });
  await tx.metadataSnapshot.create({
    data: {
      gameId,
      provider: "RAWG",
      payload: toRawgMetadataPayload(game, fetchedAt) as unknown as Prisma.InputJsonValue,
      sourceUrl: game.rawgUrl,
      fetchedAt,
    },
  });
}

export async function persistRawgMatch(
  gameId: string,
  result: RawgMatchResult,
  fetchedAt = new Date(),
): Promise<RawgPersistenceResult> {
  if (result.outcome !== "MATCHED") {
    return {
      success: false,
      data: null,
      error: {
        code: "NOT_MATCHED",
        message: "Only a matched RAWG result can be persisted",
      },
    };
  }

  try {
    await prisma.$transaction((tx) =>
      persistMatchedRawgGame(
        tx,
        gameId,
        result.game,
        result.matchMethod,
        fetchedAt,
      ),
    );

    return {
      success: true,
      data: { gameId, rawgId: result.game.id, fetchedAt },
      error: null,
    };
  } catch (error) {
    const isConflict = error instanceof RawgIdentityConflictError;
    return {
      success: false,
      data: null,
      error: {
        code: isConflict ? "RAWG_ID_CONFLICT" : "PERSISTENCE_FAILED",
        message: isConflict
          ? error.message
          : "RAWG metadata could not be saved",
      },
    };
  }
}
