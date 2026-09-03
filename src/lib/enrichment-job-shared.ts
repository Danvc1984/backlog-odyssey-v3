import "server-only";

import type { Prisma, Provider } from "@/generated/prisma/client";

export function jobRetryDelay(attempt: number): number {
  return 1000 * 2 ** Math.max(0, attempt - 1);
}

export function isRetryableJobProviderError(error: {
  category: string;
  status?: number;
}): boolean {
  return (
    error.category === "NETWORK" ||
    (error.category === "HTTP" &&
      (error.status === 429 || (error.status !== undefined && error.status >= 500)))
  );
}

export function jobClaimWhere(input: {
  jobId: string;
  provider: Provider;
  maxAttempts: number;
  now: Date;
}): Prisma.EnrichmentJobWhereInput {
  return {
    id: input.jobId,
    provider: input.provider,
    game: {
      OR: [
        { libraryEntry: { is: null } },
        { libraryEntry: { is: { hidden: false } } },
      ],
    },
    attempt: { lt: input.maxAttempts },
    OR: [
      { status: "QUEUED" },
      { status: "RETRY_WAIT", nextAttemptAt: { lte: input.now } },
    ],
  };
}

export function jobRetryUpdateData(input: {
  progress: number;
  attempt: number;
  code: string;
  message: string;
}): Prisma.EnrichmentJobUpdateInput {
  return {
    status: "RETRY_WAIT",
    stage: "RETRYING",
    progress: input.progress,
    nextAttemptAt: new Date(Date.now() + jobRetryDelay(input.attempt)),
    lastErrorCode: input.code,
    lastErrorMessage: input.message,
    finishedAt: null,
  };
}

export function jobTerminalUpdateData(input: {
  progress: number;
  code: string;
  message: string;
}): Prisma.EnrichmentJobUpdateInput {
  return {
    status: "FAILED",
    stage: "FAILED",
    progress: input.progress,
    nextAttemptAt: null,
    lastErrorCode: input.code,
    lastErrorMessage: input.message,
    finishedAt: new Date(),
  };
}

export function jobSuccessUpdateData(input: {
  progress: number;
}): Prisma.EnrichmentJobUpdateInput {
  return {
    status: "SUCCEEDED",
    stage: "COMPLETE",
    progress: input.progress,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    finishedAt: new Date(),
  };
}
