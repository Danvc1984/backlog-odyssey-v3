import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  IGDB_EXTERNAL_NAMESPACE,
  type IgdbGameResponse,
  type IgdbMetadataPayload,
  type IgdbMatchResult,
  type IgdbMatchMethod,
} from "./igdb-types";
import { parseIgdbGameToPayload } from "./igdb-metadata-payload";
import { extractPaletteFromImageBytes } from "./palette";

type IgdbTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type IgdbPersistenceResult =
  | { success: true; data: { gameId: string; igdbId: number }; error: null }
  | {
      success: false;
      data: null;
      error: { code: "NOT_MATCHED" | "IGDB_ID_CONFLICT" | "PERSISTENCE_FAILED"; message: string };
    };

export type IgdbSnapshotPersistenceResult =
  | { success: true; data: { gameId: string; fetchedAt: Date }; error: null }
  | {
      success: false;
      data: null;
      error: { code: "PERSISTENCE_FAILED"; message: string };
    };

export type PlaytimeEvidencePersistenceResult =
  | { success: true; data: { gameId: string; provider: "IGDB" | "STEAMSPY" }; error: null }
  | { success: false; data: null; error: { code: "PERSISTENCE_FAILED"; message: string } };

export interface IgdbSnapshotPersistenceOptions {
  fetchImage?: typeof fetch;
}

const IMAGE_FETCH_TIMEOUT_MS = 10_000;

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

export function selectIgdbPaletteSources(
  payload: Pick<IgdbMetadataPayload, "artworkUrls" | "screenshots" | "coverUrl">,
): string[] {
  return [
    payload.artworkUrls[0],
    payload.screenshots[0]?.image,
    payload.coverUrl,
  ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

async function captureIgdbPalette(
  payload: IgdbMetadataPayload,
  fetchImage: typeof fetch,
): Promise<IgdbMetadataPayload["palette"]> {
  for (const url of selectIgdbPaletteSources(payload)) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const imageBytes = await Promise.race([
        fetchImage(url, { signal: controller.signal }).then(async (response) => {
          if (!response.ok) return null;
          return Buffer.from(await response.arrayBuffer());
        }),
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), IMAGE_FETCH_TIMEOUT_MS);
        }),
      ]);

      if (imageBytes) {
        const palette = await extractPaletteFromImageBytes(imageBytes);
        if (palette) return palette;
      }
    } catch {
      // Palette capture is best effort; the next image source remains eligible.
    } finally {
      if (timeout) clearTimeout(timeout);
      controller.abort();
    }
  }

  return null;
}

export async function persistIgdbSnapshot(
  gameId: string,
  game: IgdbGameResponse,
  fetchedAt: Date,
  options: IgdbSnapshotPersistenceOptions = {},
): Promise<IgdbSnapshotPersistenceResult> {
  const payload = parseIgdbGameToPayload(game, fetchedAt);
  const palette = await captureIgdbPalette(payload, options.fetchImage ?? fetch);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.metadataSnapshot.deleteMany({
        where: { gameId, provider: "IGDB" },
      });
      await tx.metadataSnapshot.create({
        data: {
          gameId,
          provider: "IGDB",
          payload: { ...payload, palette } as unknown as Prisma.InputJsonValue,
          sourceUrl: payload.attribution.sourceUrl,
          fetchedAt,
        },
      });
    });

    return { success: true, data: { gameId, fetchedAt }, error: null };
  } catch {
    return {
      success: false,
      data: null,
      error: { code: "PERSISTENCE_FAILED", message: "IGDB metadata could not be saved" },
    };
  }
}

export async function persistPlaytimeEvidence(
  gameId: string,
  provider: "IGDB" | "STEAMSPY",
  payload: Prisma.InputJsonValue,
  sourceUrl: string | null,
  fetchedAt: Date,
): Promise<PlaytimeEvidencePersistenceResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.playtimeEvidence.deleteMany({ where: { gameId } });
      await tx.playtimeEvidence.create({
        data: { gameId, provider, payload, sourceUrl, fetchedAt },
      });
    });
    return { success: true, data: { gameId, provider }, error: null };
  } catch {
    return {
      success: false,
      data: null,
      error: { code: "PERSISTENCE_FAILED", message: "Playtime evidence could not be saved" },
    };
  }
}
