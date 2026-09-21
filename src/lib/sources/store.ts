import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  KNOWN_SOURCES,
  normalizeSourceName,
} from "@/lib/sources/known-sources";

export type SourceClient = Pick<
  Prisma.TransactionClient,
  "alternativeSource"
>;

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