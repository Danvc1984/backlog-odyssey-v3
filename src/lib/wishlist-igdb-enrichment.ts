import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchIgdbGameTimeToBeats, fetchIgdbSteamAppId, matchIgdbGame } from "./igdb-api";
import type { IgdbGameResponse, IgdbGameTimeToBeats, IgdbMatchMethod, IgdbMetadataPayload } from "./igdb-types";
import { parseIgdbGameToPayload } from "./igdb-metadata-payload";
import { captureIgdbPalette } from "./igdb-enrichment";
import { fetchSteamSpyMedian } from "./steamspy-api";
import { findConflictingEntry } from "@/lib/wishlist-identity";
import { silentlyRefreshWishlistCompatibility } from "./wishlist-compatibility-runner";

type WishlistIgdbTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type WishlistDurationEvidence = {
  provider: "IGDB" | "STEAMSPY";
  payload: IgdbGameTimeToBeats | { appId: string; medianForeverMinutes: number };
  sourceUrl: string | null;
  fetchedAt: string;
};

export type WishlistIgdbSnapshotPayload = IgdbMetadataPayload & {
  matchMethod: IgdbMatchMethod;
  durationEvidence: WishlistDurationEvidence | null;
};

export type WishlistIgdbSnapshotPersistenceResult =
  | { success: true; data: { wishlistEntryId: string; fetchedAt: Date }; error: null }
  | { success: false; data: null; error: { code: "PERSISTENCE_FAILED"; message: string } };

export type WishlistIgdbEnrichmentResult =
  | {
      success: true;
      data: {
        igdbId: number;
        name: string;
        matchMethod: IgdbMatchMethod;
        steamAppIdApplied: string | null;
        steamAppIdConflict: string | null;
      };
      error: null;
    }
  | { success: false; data: null; error: string };

export interface WishlistIgdbSnapshotPersistenceOptions {
  fetchImage?: typeof fetch;
}

function hasUsableIgdbDuration(payload: IgdbGameTimeToBeats | null): payload is IgdbGameTimeToBeats {
  return payload !== null && [payload.hastilySeconds, payload.normallySeconds, payload.completelySeconds]
    .some((seconds) => typeof seconds === "number" && seconds > 0);
}

function isConfirmedIdentity(entry: { steamAppId: string | null; steamAppIdProvenance: string | null }): boolean {
  return entry.steamAppId !== null && entry.steamAppIdProvenance !== null;
}

export async function enrichWishlistBaseGameFromIgdb(input: {
  entry: {
    id: string;
    name: string;
    type: string;
    steamAppId: string | null;
    steamAppIdProvenance: string | null;
  };
  selectedIgdbId?: number | null;
}): Promise<WishlistIgdbEnrichmentResult> {
  if (input.entry.type !== "BASE_GAME") {
    return { success: false, data: null, error: "IGDB metadata is only available for base-game wishes" };
  }

  const match = await matchIgdbGame({
    title: input.entry.name,
    category: "MAIN_GAME",
    steamAppId: input.entry.steamAppId,
    selectedIgdbId: input.selectedIgdbId ?? null,
  });
  if (match.outcome !== "MATCHED") {
    return {
      success: false,
      data: null,
      error: match.outcome === "UNAVAILABLE" ? match.error.message : `IGDB match outcome: ${match.outcome}`,
    };
  }

  const confirmed = isConfirmedIdentity(input.entry);
  let steamAppIdApplied: string | null = null;
  let steamAppIdConflict: string | null = null;
  let derivedSteamAppId: string | null = null;

  const derivedIdentityPromise = confirmed
    ? Promise.resolve(null)
    : fetchIgdbSteamAppId(match.game.id).catch(() => null);
  const durationPromise = fetchIgdbGameTimeToBeats(match.game.id).catch(() => null);
  const [derivedIdentity, igdbDuration] = await Promise.all([
    derivedIdentityPromise,
    durationPromise,
  ]);
  if (derivedIdentity?.ok) derivedSteamAppId = derivedIdentity.data;

  if (!confirmed && derivedSteamAppId) {
    try {
      const conflict = await findConflictingEntry(prisma, derivedSteamAppId, input.entry.id);
      if (conflict) {
        steamAppIdConflict = `Steam App ID ${derivedSteamAppId} is already used by ${conflict.name}`;
      } else {
        try {
          await prisma.wishlistEntry.update({
            where: { id: input.entry.id },
            data: { steamAppId: derivedSteamAppId, steamAppIdProvenance: "IGDB_SUGGESTION" },
          });
          steamAppIdApplied = derivedSteamAppId;
          try {
            await silentlyRefreshWishlistCompatibility(input.entry.id);
          } catch {
            // Compatibility refresh is best effort after identity application.
          }
        } catch {
          // Identity persistence is best effort; the matched snapshot still persists.
        }
      }
    } catch {
      // Identity conflict lookup is best effort; the matched snapshot still persists.
    }
  }

  const appIdForDuration = input.entry.steamAppId ?? derivedSteamAppId;
  let durationEvidence: WishlistDurationEvidence | null = null;
  try {
    if (igdbDuration?.ok && hasUsableIgdbDuration(igdbDuration.data)) {
      durationEvidence = {
        provider: "IGDB",
        payload: igdbDuration.data,
        sourceUrl: match.game.slug ? `https://www.igdb.com/games/${match.game.slug}` : null,
        fetchedAt: new Date().toISOString(),
      };
    } else if (appIdForDuration) {
      const steamSpy = await fetchSteamSpyMedian(appIdForDuration);
      if (steamSpy.ok && steamSpy.data) {
        durationEvidence = {
          provider: "STEAMSPY",
          payload: { appId: appIdForDuration, medianForeverMinutes: steamSpy.data.medianForeverMinutes },
          sourceUrl: `https://steamspy.com/app/${appIdForDuration}`,
          fetchedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Duration evidence is best effort and never blocks metadata persistence.
  }

  const persisted = await persistWishlistIgdbSnapshot(
    input.entry.id,
    match.game,
    match.matchMethod,
    durationEvidence,
    new Date(),
  );
  if (!persisted.success) return { success: false, data: null, error: persisted.error.message };

  return {
    success: true,
    data: {
      igdbId: match.game.id,
      name: match.game.name ?? input.entry.name,
      matchMethod: match.matchMethod,
      steamAppIdApplied,
      steamAppIdConflict,
    },
    error: null,
  };
}

export async function persistWishlistIgdbSnapshot(
  wishlistEntryId: string,
  game: IgdbGameResponse,
  matchMethod: IgdbMatchMethod,
  durationEvidence: WishlistDurationEvidence | null,
  fetchedAt: Date,
  options: WishlistIgdbSnapshotPersistenceOptions = {},
): Promise<WishlistIgdbSnapshotPersistenceResult> {
  const payload = parseIgdbGameToPayload(game, fetchedAt);
  const palette = await captureIgdbPalette(payload, options.fetchImage ?? fetch);
  const snapshotPayload: WishlistIgdbSnapshotPayload = {
    ...payload,
    palette,
    matchMethod,
    durationEvidence,
  };

  try {
    await prisma.$transaction(async (tx: WishlistIgdbTransactionClient) => {
      await tx.wishlistMetadataSnapshot.deleteMany({ where: { wishlistEntryId } });
      await tx.wishlistMetadataSnapshot.create({
        data: {
          wishlistEntryId,
          provider: "IGDB",
          payload: snapshotPayload as unknown as Prisma.InputJsonValue,
          sourceUrl: payload.attribution.sourceUrl,
          fetchedAt,
        },
      });
    });
    return { success: true, data: { wishlistEntryId, fetchedAt }, error: null };
  } catch {
    return {
      success: false,
      data: null,
      error: { code: "PERSISTENCE_FAILED", message: "Wishlist IGDB metadata could not be saved" },
    };
  }
}
