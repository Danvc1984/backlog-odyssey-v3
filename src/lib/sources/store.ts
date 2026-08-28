import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  KNOWN_SOURCES,
  UNSPECIFIED_OTHER_SOURCE_NAME,
  normalizeSourceName,
} from "@/lib/sources/known-sources";

export type SourceClient = Pick<
  Prisma.TransactionClient,
  "alternativeSource"
>;

export async function getOrCreateUnspecifiedSource(tx: SourceClient) {
  const normalized = normalizeSourceName(UNSPECIFIED_OTHER_SOURCE_NAME);
  const existing = await tx.alternativeSource.findUnique({
    where: { normalizedName: normalized },
  });
  if (existing) return existing;
  return tx.alternativeSource.create({
    data: { name: UNSPECIFIED_OTHER_SOURCE_NAME, normalizedName: normalized },
  });
}

export async function findOrCreateSourceByKnownKey(
  tx: SourceClient,
  key: string,
) {
  const known = KNOWN_SOURCES.find((source) => source.key === key);
  if (!known) throw new Error(`Unknown known source key: ${key}`);
  const existing = await tx.alternativeSource.findUnique({
    where: { knownKey: known.key },
  });
  if (existing) return existing;
  return tx.alternativeSource.create({
    data: {
      knownKey: known.key,
      name: known.label,
      normalizedName: normalizeSourceName(known.label),
    },
  });
}