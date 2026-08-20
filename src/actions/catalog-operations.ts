"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  buildDeleteSnapshotPlan,
  buildMergeProposal,
  createSnapshotEnvelope,
  isOperationExpired,
  operationExpiry,
  parseSnapshotEnvelope,
  planMergeMutations,
  resolveMergePlan,
  resolveOperationUser,
  uniqueGameIds,
  type MergeExecutionChoices,
  type MergeGraphGame,
  type MergeSnapshotPayload,
  type MergeSourceGame,
  type MergeSourceLibraryEntry,
  type SnapshotModel,
} from "@/lib/catalog-operations";

const proposeMergeSchema = z.object({
  duplicateId: z.string().min(1, "Duplicate ID is required"),
});

const gameIdSchema = z.object({
  gameId: z.string().min(1, "Game ID is required"),
});

const executeMergeSchema = z.object({
  duplicateId: z.string().min(1, "Duplicate ID is required"),
  survivorId: z.string().min(1, "Survivor ID is required"),
  finalName: z.string().trim().min(1, "Final name is required"),
  personal: z.record(z.string(), z.unknown()),
  externalIds: z.record(z.string(), z.unknown()),
  oneToOne: z.record(z.string(), z.unknown()),
});

function toMergeSourceGame(game: {
  id: string;
  name: string;
  origin: string;
  libraryEntry: MergeSourceLibraryEntry | null;
  externalIds: { id: string; namespace: string; externalId: string; gameId: string }[];
  dlcs: { id: string; name: string }[];
  availability: { id: string; source: string; steamAppId: string | null }[];
  collections: { collectionId: string }[];
  tags: { tagId: string }[];
  metadataSnapshots: { id: string; provider: string }[];
  compatSnapshots: { id: string; provider: string }[];
  envCompat: { id: string; environment: string }[];
}): MergeSourceGame {
  return {
    id: game.id,
    name: game.name,
    origin: game.origin,
    libraryEntry: game.libraryEntry,
    externalIds: game.externalIds,
    dlc: game.dlcs,
    availability: game.availability,
    collections: game.collections,
    tags: game.tags,
    metadataSnapshots: game.metadataSnapshots,
    compatSnapshots: game.compatSnapshots,
    envCompat: game.envCompat,
  };
}

export async function proposeMerge(input: { duplicateId: string }) {
  try {
    await requireUser();

    const parsed = proposeMergeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }
    const { duplicateId } = parsed.data;

    const duplicate = await prisma.possibleDuplicate.findUnique({
      where: { id: duplicateId },
      select: { id: true, status: true, gameAId: true, gameBId: true },
    });
    if (!duplicate) {
      return { success: false as const, data: null, error: "Duplicate not found" };
    }
    if (duplicate.gameAId === duplicate.gameBId) {
      return {
        success: false as const,
        data: null,
        error: "Duplicate pair is invalid",
      };
    }
    if (duplicate.status !== "OPEN") {
      return {
        success: false as const,
        data: null,
        error: "Duplicate has already been reviewed",
      };
    }

    const gameIds = [duplicate.gameAId, duplicate.gameBId];

    const pendingOperation = await prisma.catalogOperation.findFirst({
      where: { state: "PENDING", affectedGameIds: { hasSome: gameIds } },
      select: { id: true },
    });
    if (pendingOperation) {
      return {
        success: false as const,
        data: null,
        error: "A recent catalog operation still involves these games",
      };
    }

    const games = await prisma.game.findMany({
      where: { id: { in: gameIds } },
      select: {
        id: true,
        name: true,
        origin: true,
        type: true,
        libraryEntry: {
          select: {
            playState: true,
            isMainGame: true,
            priority: true,
            interest: true,
            rating: true,
            preferredEnvironment: true,
            compatOverrideStatus: true,
            compatOverrideReason: true,
            playSoon: true,
            replayCandidate: true,
            hidden: true,
            notes: true,
          },
        },
        externalIds: true,
        dlcs: { select: { id: true, name: true } },
        availability: { select: { id: true, source: true, steamAppId: true } },
        collections: { select: { collectionId: true } },
        tags: { select: { tagId: true } },
        metadataSnapshots: { select: { id: true, provider: true } },
        wishlistDlcs: { select: { id: true } },
        compatSnapshots: { select: { id: true, provider: true } },
        envCompat: { select: { id: true, environment: true } },
      },
    });

    if (games.length !== 2) {
      return {
        success: false as const,
        data: null,
        error: "Duplicate references a missing game",
      };
    }

    const byId = new Map(games.map((game) => [game.id, game]));
    const gameA = byId.get(duplicate.gameAId);
    const gameB = byId.get(duplicate.gameBId);
    if (!gameA || !gameB) {
      return {
        success: false as const,
        data: null,
        error: "Duplicate references a missing game",
      };
    }
    if (gameA.type !== "BASE_GAME" || gameB.type !== "BASE_GAME") {
      return {
        success: false as const,
        data: null,
        error: "Duplicate references a non-base game",
      };
    }

    const proposal = buildMergeProposal({
      duplicateId,
      gameA: toMergeSourceGame(gameA),
      gameB: toMergeSourceGame(gameB),
    });

    return { success: true as const, data: proposal, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to build merge proposal",
    };
  }
}

const GAME_GRAPH_INCLUDE = {
  libraryEntry: true,
  externalIds: true,
  dlcs: {
    select: {
      id: true,
      name: true,
      type: true,
      origin: true,
      baseGameId: true,
      importAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  availability: true,
  collections: true,
  tags: true,
  metadataSnapshots: true,
  wishlistDlcs: { include: { offers: true, refreshes: true, metadataSnapshot: true } },
  compatSnapshots: true,
  envCompat: true,
  duplicatesA: true,
  duplicatesB: true,
};

function orderedPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

async function executeMergeTransaction(
  tx: Prisma.TransactionClient,
  input: {
    duplicateId: string;
    survivorId: string;
    finalName: string;
    personal: Record<string, unknown>;
    externalIds: Record<string, unknown>;
    oneToOne: Record<string, unknown>;
    userId: string;
  },
) {
  const duplicate = await tx.possibleDuplicate.findUnique({
    where: { id: input.duplicateId },
  });
  if (!duplicate) throw new Error("Duplicate not found");
  if (duplicate.gameAId === duplicate.gameBId) throw new Error("Duplicate pair is invalid");
  if (duplicate.status !== "OPEN") throw new Error("Duplicate has already been reviewed");

  const gameIds = [duplicate.gameAId, duplicate.gameBId];
  const pending = await tx.catalogOperation.findFirst({
    where: { state: "PENDING", affectedGameIds: { hasSome: gameIds } },
  });
  if (pending) {
    throw new Error("A recent catalog operation still involves these games");
  }

  const games = await tx.game.findMany({
    where: { id: { in: gameIds } },
    include: GAME_GRAPH_INCLUDE,
  });
  if (games.length !== 2) throw new Error("Duplicate references a missing game");
  const byId = new Map(games.map((game) => [game.id, game]));
  const gameA = byId.get(duplicate.gameAId);
  const gameB = byId.get(duplicate.gameBId);
  if (!gameA || !gameB) throw new Error("Duplicate references a missing game");
  if (gameA.type !== "BASE_GAME" || gameB.type !== "BASE_GAME") {
    throw new Error("Duplicate references a non-base game");
  }

  const proposal = buildMergeProposal({
    duplicateId: input.duplicateId,
    gameA: toMergeSourceGame(gameA),
    gameB: toMergeSourceGame(gameB),
  });

  const resolved = resolveMergePlan(proposal, {
    survivorId: input.survivorId,
    finalName: input.finalName,
    personal: input.personal as MergeExecutionChoices["personal"],
    externalIds: input.externalIds as MergeExecutionChoices["externalIds"],
    oneToOne: input.oneToOne as MergeExecutionChoices["oneToOne"],
  });
  if (!resolved.ok) throw new Error(resolved.message);

  const mutationPlan = planMergeMutations({
    gameA: gameA as MergeGraphGame,
    gameB: gameB as MergeGraphGame,
    plan: resolved.plan,
  });

  const survivorId = mutationPlan.survivorId;
  const discardedId = mutationPlan.discardedId;

  if (mutationPlan.libraryEntry) {
    await tx.libraryEntry.update({
      where: { id: mutationPlan.libraryEntry.rowId },
      data: mutationPlan.libraryEntry.data,
    });
  }
  await Promise.all(
    mutationPlan.externalIdMoves.map((move) =>
      tx.externalGameId.update({ where: { id: move.id }, data: { gameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.externalIdDeletes.map((move) =>
      tx.externalGameId.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.availabilityMoves.map((move) =>
      tx.gameAvailability.update({ where: { id: move.id }, data: { gameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.availabilityDeletes.map((move) =>
      tx.gameAvailability.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.availabilityMerges.map((merge) =>
      tx.gameAvailability.update({ where: { id: merge.rowId }, data: merge.data }),
    ),
  );
  await Promise.all(
    mutationPlan.collectionMoves.map((move) =>
      tx.collectionMembership.updateMany({
        where: { collectionId: move.key, gameId: discardedId },
        data: { gameId: survivorId },
      }),
    ),
  );
  await Promise.all(
    mutationPlan.collectionDeletes.map((move) =>
      tx.collectionMembership.deleteMany({
        where: { collectionId: move.key, gameId: discardedId },
      }),
    ),
  );
  await Promise.all(
    mutationPlan.tagMoves.map((move) =>
      tx.gameTag.updateMany({
        where: { tagId: move.key, gameId: discardedId },
        data: { gameId: survivorId },
      }),
    ),
  );
  await Promise.all(
    mutationPlan.tagDeletes.map((move) =>
      tx.gameTag.deleteMany({ where: { tagId: move.key, gameId: discardedId } }),
    ),
  );
  await Promise.all(
    mutationPlan.metadataMoves.map((move) =>
      tx.metadataSnapshot.update({ where: { id: move.id }, data: { gameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.metadataDeletes.map((move) =>
      tx.metadataSnapshot.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.wishlistMoves.map((move) =>
      tx.wishlistEntry.update({ where: { id: move.id }, data: { baseGameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.wishlistDeletes.map((move) =>
      tx.wishlistEntry.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.compatMoves.map((move) =>
      tx.compatibilitySnapshot.update({ where: { id: move.id }, data: { gameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.compatDeletes.map((move) =>
      tx.compatibilitySnapshot.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.envMoves.map((move) =>
      tx.environmentCompatibility.update({ where: { id: move.id }, data: { gameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.envDeletes.map((move) =>
      tx.environmentCompatibility.delete({ where: { id: move.id } }),
    ),
  );
  await Promise.all(
    mutationPlan.dlcMoves.map((move) =>
      tx.game.update({ where: { id: move.id }, data: { baseGameId: survivorId } }),
    ),
  );
  await Promise.all(
    mutationPlan.duplicateMoves.map((move) => {
      const original = move.row as { gameAId?: string; gameBId?: string };
      const remapped = orderedPair(
        original.gameAId === discardedId ? survivorId : original.gameAId ?? survivorId,
        original.gameBId === discardedId ? survivorId : original.gameBId ?? survivorId,
      );
      return tx.possibleDuplicate.update({
        where: { id: move.id },
        data: { gameAId: remapped[0], gameBId: remapped[1] },
      });
    }),
  );
  await Promise.all(
    mutationPlan.duplicateDeletes.map((move) =>
      tx.possibleDuplicate.delete({ where: { id: move.id } }),
    ),
  );

  await tx.game.update({ where: { id: survivorId }, data: { name: mutationPlan.finalName } });
  await tx.game.delete({ where: { id: discardedId } });

  const now = new Date();
  const operation = await tx.catalogOperation.create({
    data: {
      userId: input.userId,
      type: "MERGE",
      state: "PENDING",
      affectedGameIds: uniqueGameIds(mutationPlan.affectedGameIds),
      snapshot: createSnapshotEnvelope(
        mutationPlan.snapshot,
        "MERGE",
        now,
      ) as unknown as Prisma.InputJsonValue,
      expiresAt: operationExpiry(now),
    },
  });

  return {
    operationId: operation.id,
    state: operation.state,
    expiresAt: operation.expiresAt,
    survivorId,
    discardedId,
  };
}

export async function executeMerge(input: z.infer<typeof executeMergeSchema>) {
  try {
    const session = await requireUser();
    const user = await resolveOperationUser(session.user?.email);
    if (!user) {
      return { success: false as const, data: null, error: "Authentication required" };
    }

    const parsed = executeMergeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction((tx) =>
      executeMergeTransaction(tx, { ...parsed.data, userId: user.id }),
    );

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to merge games",
    };
  }
}

export async function previewDelete(input: z.infer<typeof gameIdSchema>) {
  try {
    await requireUser();

    const parsed = gameIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }
    const { gameId } = parsed.data;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        type: true,
        baseGameId: true,
        baseGame: { select: { id: true, name: true } },
        dlcs: { select: { id: true, name: true } },
        wishlistDlcs: { select: { id: true } },
        _count: {
          select: {
            externalIds: true,
            availability: true,
            collections: true,
            tags: true,
            metadataSnapshots: true,
            compatSnapshots: true,
            envCompat: true,
          },
        },
      },
    });
    if (!game) {
      return { success: false as const, data: null, error: "Game not found" };
    }

    const pending = await prisma.catalogOperation.findFirst({
      where: { state: "PENDING", affectedGameIds: { hasSome: [gameId] } },
      select: { id: true },
    });
    if (pending) {
      return {
        success: false as const,
        data: null,
        error: "A recent catalog operation still involves this game",
      };
    }

    return {
      success: true as const,
      data: {
        game: { id: game.id, name: game.name, type: game.type },
        baseGame: game.baseGame,
        dlc: game.dlcs,
        relations: {
          externalIds: game._count.externalIds,
          availability: game._count.availability,
          collections: game._count.collections,
          tags: game._count.tags,
          metadataSnapshots: game._count.metadataSnapshots,
          compatSnapshots: game._count.compatSnapshots,
          envCompat: game._count.envCompat,
          wishlist: game.wishlistDlcs.length > 0,
          wishlistDlcCount: game.wishlistDlcs.length,
        },
      },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to preview deletion",
    };
  }
}

async function executeDeleteTransaction(
  tx: Prisma.TransactionClient,
  input: { gameId: string; userId: string },
) {
  const root = await tx.game.findUnique({
    where: { id: input.gameId },
    include: GAME_GRAPH_INCLUDE,
  });
  if (!root) throw new Error("Game not found");

  const subtreeIds = new Set([root.id]);
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = await tx.game.findMany({
      where: { baseGameId: { in: frontier } },
      select: { id: true },
    });
    const next = children
      .map((child) => child.id)
      .filter((id) => !subtreeIds.has(id));
    if (next.length === 0) break;
    for (const id of next) subtreeIds.add(id);
    frontier = next;
  }

  const graphs = await tx.game.findMany({
    where: { id: { in: [...subtreeIds] } },
    include: GAME_GRAPH_INCLUDE,
  });
  if (graphs.length !== subtreeIds.size) throw new Error("Game not found");
  const rootGraph = graphs.find((game) => game.id === root.id) as MergeGraphGame;
  const descendants = graphs
    .filter((game) => game.id !== root.id)
    .map((game) => game as MergeGraphGame);

  const plan = buildDeleteSnapshotPlan(rootGraph, descendants);

  const pending = await tx.catalogOperation.findFirst({
    where: { state: "PENDING", affectedGameIds: { hasSome: plan.affectedGameIds } },
  });
  if (pending) {
    throw new Error("A recent catalog operation still involves this game");
  }

  await tx.game.delete({ where: { id: root.id } });

  const now = new Date();
  const operation = await tx.catalogOperation.create({
    data: {
      userId: input.userId,
      type: "DELETE",
      state: "PENDING",
      affectedGameIds: uniqueGameIds(plan.affectedGameIds),
      snapshot: createSnapshotEnvelope(
        plan.snapshot,
        "DELETE",
        now,
      ) as unknown as Prisma.InputJsonValue,
      expiresAt: operationExpiry(now),
    },
  });

  return {
    operationId: operation.id,
    state: operation.state,
    expiresAt: operation.expiresAt,
    gameId: root.id,
  };
}

export async function executeDelete(input: z.infer<typeof gameIdSchema>) {
  try {
    const session = await requireUser();
    const user = await resolveOperationUser(session.user?.email);
    if (!user) {
      return { success: false as const, data: null, error: "Authentication required" };
    }

    const parsed = gameIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction((tx) =>
      executeDeleteTransaction(tx, { gameId: parsed.data.gameId, userId: user.id }),
    );

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to delete game",
    };
  }
}

const MODEL_DELEGATES: Record<SnapshotModel, string> = {
  Game: "game",
  LibraryEntry: "libraryEntry",
  ExternalGameId: "externalGameId",
  GameAvailability: "gameAvailability",
  CollectionMembership: "collectionMembership",
  GameTag: "gameTag",
  MetadataSnapshot: "metadataSnapshot",
  WishlistEntry: "wishlistEntry",
  WishlistMetadataSnapshot: "wishlistMetadataSnapshot",
  DealOffer: "dealOffer",
  PriceRefresh: "priceRefresh",
  CompatibilitySnapshot: "compatibilitySnapshot",
  EnvironmentCompatibility: "environmentCompatibility",
  PossibleDuplicate: "possibleDuplicate",
};

const RESTORE_ORDER: SnapshotModel[] = [
  "WishlistEntry",
  "WishlistMetadataSnapshot",
  "DealOffer",
  "PriceRefresh",
  "LibraryEntry",
  "ExternalGameId",
  "GameAvailability",
  "CollectionMembership",
  "GameTag",
  "MetadataSnapshot",
  "CompatibilitySnapshot",
  "EnvironmentCompatibility",
  "PossibleDuplicate",
];

const MODEL_DATE_FIELDS: Partial<Record<SnapshotModel, string[]>> = {
  Game: ["createdAt", "updatedAt", "importAt"],
  LibraryEntry: ["createdAt", "updatedAt"],
  WishlistEntry: ["createdAt", "updatedAt"],
  WishlistMetadataSnapshot: ["fetchedAt", "expiresAt"],
  DealOffer: ["expiresAt", "fetchedAt"],
  PriceRefresh: ["requestedAt", "finishedAt"],
  ExternalGameId: ["createdAt", "updatedAt"],
  GameAvailability: ["addedAt", "steamLastPlayed"],
  CollectionMembership: ["addedAt"],
  MetadataSnapshot: ["fetchedAt", "expiresAt"],
  CompatibilitySnapshot: ["fetchedAt", "expiresAt"],
  EnvironmentCompatibility: ["updatedAt"],
  PossibleDuplicate: ["reviewedAt"],
};

const MODEL_BIGINT_FIELDS: Partial<Record<SnapshotModel, string[]>> = {
  GameAvailability: ["steamPlaytimeTotal"],
};

function reviveRow(model: SnapshotModel, row: Record<string, unknown>): Record<string, unknown> {
  const revived: Record<string, unknown> = { ...row };
  delete revived.updatedAt;
  for (const field of MODEL_DATE_FIELDS[model] ?? []) {
    if (typeof revived[field] === "string") revived[field] = new Date(revived[field] as string);
  }
  for (const field of MODEL_BIGINT_FIELDS[model] ?? []) {
    if (typeof revived[field] === "string") revived[field] = BigInt(revived[field] as string);
  }
  return revived;
}

function restoreUpdateData(
  model: SnapshotModel,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const data = reviveRow(model, row);
  delete data.id;
  return data;
}

async function recreateRow(
  tx: Prisma.TransactionClient,
  model: SnapshotModel,
  row: Record<string, unknown>,
) {
  const delegate = (
    tx as unknown as Record<string, { create: (args: { data: Record<string, unknown> }) => Promise<unknown> }>
  )[MODEL_DELEGATES[model]];
  await delegate.create({ data: reviveRow(model, row) });
}

async function restoreUpdatedRow(
  tx: Prisma.TransactionClient,
  model: SnapshotModel,
  row: Record<string, unknown>,
  payload: MergeSnapshotPayload,
) {
  const delegate = (
    tx as unknown as Record<
      string,
      {
        update: (args: Record<string, unknown>) => Promise<unknown>;
        updateMany: (args: Record<string, unknown>) => Promise<unknown>;
      }
    >
  )[MODEL_DELEGATES[model]];
  if (model === "CollectionMembership" || model === "GameTag") {
    const keyField = model === "CollectionMembership" ? "collectionId" : "tagId";
    await delegate.updateMany({
      where: {
        [keyField]: row[keyField],
        gameId: payload.survivorId,
      },
      data: { gameId: row.gameId },
    });
    return;
  }
  await delegate.update({ where: { id: row.id }, data: restoreUpdateData(model, row) });
}

async function restoreSnapshot(
  tx: Prisma.TransactionClient,
  records: MergeSnapshotPayload["records"],
  payload: MergeSnapshotPayload,
) {
  const gameCreates = records
    .filter((record) => record.model === "Game" && record.action === "delete")
    .sort((a, b) => {
      const aBase = a.row.baseGameId == null ? 0 : 1;
      const bBase = b.row.baseGameId == null ? 0 : 1;
      return aBase - bBase;
    });
  for (const record of gameCreates) {
    await recreateRow(tx, "Game", record.row);
  }

  const gameUpdates = records.filter(
    (record) => record.model === "Game" && record.action === "update",
  );
  for (const record of gameUpdates) {
    await restoreUpdatedRow(tx, "Game", record.row, payload);
  }

  for (const model of RESTORE_ORDER) {
    for (const record of records) {
      if (record.model !== model) continue;
      if (record.action === "delete") {
        await recreateRow(tx, model, record.row);
      } else {
        await restoreUpdatedRow(tx, model, record.row, payload);
      }
    }
  }
}

const operationIdSchema = z.object({
  operationId: z.string().min(1, "Operation ID is required"),
});

export async function getActiveOperations() {
  try {
    const session = await requireUser();
    const user = await resolveOperationUser(session.user?.email);
    if (!user) {
      return { success: true as const, data: [], error: null };
    }

    const now = new Date();
    await prisma.catalogOperation.updateMany({
      where: { userId: user.id, state: "PENDING", expiresAt: { lte: now } },
      data: { state: "COMPLETED", snapshot: Prisma.DbNull },
    });

    const operations = await prisma.catalogOperation.findMany({
      where: { userId: user.id, state: "PENDING", expiresAt: { gt: now } },
      select: { id: true, type: true, expiresAt: true },
      orderBy: { createdAt: "asc" },
    });

    return { success: true as const, data: operations, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to load operations",
    };
  }
}

async function undoOperationTransaction(
  tx: Prisma.TransactionClient,
  input: { operationId: string; userId: string },
) {
  const operation = await tx.catalogOperation.findUnique({
    where: { id: input.operationId },
  });
  if (!operation) throw new Error("Operation not found");
  if (operation.userId !== input.userId) throw new Error("Operation not found");

  const now = new Date();

  if (operation.state === "UNDONE" || operation.state === "COMPLETED") {
    throw new Error("This operation has already finished");
  }
  if (operation.state === "EXPIRED" || isOperationExpired(operation.expiresAt, now)) {
    await tx.catalogOperation.update({
      where: { id: operation.id },
      data: { state: "EXPIRED", snapshot: Prisma.DbNull },
    });
    throw new Error("The undo window has expired");
  }

  const overlapping = await tx.catalogOperation.findFirst({
    where: {
      state: "PENDING",
      id: { not: operation.id },
      affectedGameIds: { hasSome: operation.affectedGameIds },
    },
  });
  if (overlapping) {
    throw new Error("A newer operation now involves these games");
  }

  const envelope = parseSnapshotEnvelope<
    MergeSnapshotPayload | { gameId: string; records: MergeSnapshotPayload["records"] }
  >(operation.snapshot);
  if (!envelope) {
    throw new Error("Operation snapshot is no longer available");
  }
  const payload =
    envelope.type === "MERGE"
      ? (envelope.payload as MergeSnapshotPayload)
      : ({
          survivorId: (envelope.payload as { gameId: string }).gameId,
          discardedId: (envelope.payload as { gameId: string }).gameId,
          records: envelope.payload.records,
        } satisfies MergeSnapshotPayload);

  await restoreSnapshot(tx, payload.records, payload);
  await tx.catalogOperation.update({
    where: { id: operation.id },
    data: { state: "UNDONE", snapshot: Prisma.DbNull },
  });

  return { operationId: operation.id, state: "UNDONE" as const };
}

export async function undoOperation(input: z.infer<typeof operationIdSchema>) {
  try {
    const session = await requireUser();
    const user = await resolveOperationUser(session.user?.email);
    if (!user) {
      return { success: false as const, data: null, error: "Authentication required" };
    }

    const parsed = operationIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction((tx) =>
      undoOperationTransaction(tx, { operationId: parsed.data.operationId, userId: user.id }),
    );

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to undo operation",
    };
  }
}
