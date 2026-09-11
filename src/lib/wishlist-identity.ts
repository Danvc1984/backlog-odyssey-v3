import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

export function identityConflictMessage(appId: string, conflictingName: string): string {
  return `Steam App ID ${appId} is already on "${conflictingName}"`;
}

export async function findConflictingEntry(
  client: DbClient,
  appId: string,
  excludeEntryId?: string,
) {
  return client.wishlistEntry.findFirst({
    where: {
      steamAppId: appId,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { id: true, name: true },
  });
}
