import "server-only";

import { prisma } from "@/lib/prisma";
import {
  chunkItadIds,
  type ItadProviderError,
  lookupItadIdsByAppIds,
} from "./itad-api";

const NOT_FOUND_SENTINEL = "";

export async function resolveItadIds(
  apiKey: string,
  appIds: string[],
): Promise<Map<string, string | null> | ItadProviderError> {
  const uniqueIds = [...new Set(appIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const cached = await prisma.itadIdentity.findMany({
    where: { steamAppId: { in: uniqueIds } },
    select: { steamAppId: true, itadId: true },
  });
  const cacheMap = new Map(cached.map((row) => [row.steamAppId, row.itadId]));

  const result = new Map<string, string | null>();
  const misses: string[] = [];
  for (const appId of uniqueIds) {
    const cachedId = cacheMap.get(appId);
    if (cachedId === undefined) {
      misses.push(appId);
    } else {
      result.set(appId, cachedId === NOT_FOUND_SENTINEL ? null : cachedId);
    }
  }

  if (misses.length > 0) {
    const lookedUp = new Map<string, string | null>();
    for (const chunk of chunkItadIds(misses)) {
      const outcome = await lookupItadIdsByAppIds(apiKey, chunk);
      if ("category" in outcome) {
        return outcome;
      }
      for (const [appId, itadId] of outcome) {
        lookedUp.set(appId, itadId);
      }
    }

    await prisma.$transaction(
      [...lookedUp.entries()].map(([appId, itadId]) =>
        prisma.itadIdentity.upsert({
          where: { steamAppId: appId },
          create: { steamAppId: appId, itadId: itadId ?? NOT_FOUND_SENTINEL },
          update: { itadId: itadId ?? NOT_FOUND_SENTINEL },
        }),
      ),
    );
    for (const [appId, itadId] of lookedUp) {
      result.set(appId, itadId);
    }
  }

  return result;
}
