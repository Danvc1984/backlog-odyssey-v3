import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SyncStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Provider = "RAWG" | "PROTONDB";

interface BatchRecord {
  id: string;
  status: SyncStatus;
}

export interface ActiveEnrichmentBatch {
  kind: "ACTIVE_BATCH";
  batchId: string;
  status: SyncStatus;
}

interface Eligibility<TGame, TCounts, TNoEligible> {
  eligibleGames: TGame[];
  counts: TCounts;
  noEligibleResult?: TNoEligible;
}

interface BatchSummary<TCounts> {
  counts: TCounts;
  status: SyncStatus;
  isTerminal: boolean;
}

interface BatchStartOptions<
  TGame extends { id: string },
  TCounts,
  TSummaryCounts,
  TResult,
  TNoEligible,
> {
  provider: Provider;
  getGames: (tx: Prisma.TransactionClient) => Promise<TGame[]>;
  getEligibility: (games: TGame[]) => Eligibility<TGame, TCounts, TNoEligible>;
  summarize: (games: TGame[]) => BatchSummary<TSummaryCounts>;
  queuedJobData: (syncRunId: string) => Record<string, unknown>;
  buildResult: (batch: BatchRecord, eligibility: Eligibility<TGame, TCounts, TNoEligible>) => TResult;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function activeBatch(provider: Provider) {
  return prisma.syncRun.findFirst({
    where: { provider, status: "RUNNING" },
    select: { id: true, status: true },
  });
}

export async function startProviderEnrichmentBatch<
  TGame extends { id: string },
  TCounts,
  TSummaryCounts,
  TResult,
  TNoEligible = never,
>({
  provider,
  getGames,
  getEligibility,
  summarize,
  queuedJobData,
  buildResult,
}: BatchStartOptions<TGame, TCounts, TSummaryCounts, TResult, TNoEligible>): Promise<
  TResult | ActiveEnrichmentBatch | TNoEligible
> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const runningBatch = await tx.syncRun.findFirst({
        where: { provider, status: "RUNNING" },
        select: { id: true, status: true },
      });
      if (runningBatch) {
        return {
          kind: "ACTIVE_BATCH" as const,
          batchId: runningBatch.id,
          status: runningBatch.status,
        };
      }

      const games = await getGames(tx);
      const eligibility = getEligibility(games);
      if (eligibility.noEligibleResult !== undefined) {
        return eligibility.noEligibleResult;
      }

      const summary = summarize(eligibility.eligibleGames);
      const batch = await tx.syncRun.create({
        data: {
          provider,
          status: summary.status,
          counts: summary.counts as Prisma.InputJsonObject,
          finishedAt: summary.isTerminal ? new Date() : null,
        },
        select: { id: true, status: true },
      });

      for (const game of eligibility.eligibleGames) {
        const data = queuedJobData(batch.id);
        await tx.enrichmentJob.upsert({
          where: { gameId_provider: { gameId: game.id, provider } },
          create: { gameId: game.id, provider, ...data },
          update: data,
        });
      }

      return buildResult(batch, eligibility);
    });

    return result;
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const runningBatch = await activeBatch(provider);
      if (runningBatch) {
        return {
          kind: "ACTIVE_BATCH",
          batchId: runningBatch.id,
          status: runningBatch.status,
        };
      }
    }

    throw error;
  }
}
