import type { EnrichmentJobStage, EnrichmentJobStatus } from "@/generated/prisma/client";

export const COMPAT_JOB_MAX_ATTEMPTS = 3;

export interface CompatJobView {
  id: string;
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export type CompatJobRecord = Omit<CompatJobView, "nextAttemptAt"> & {
  provider: string;
  nextAttemptAt: Date | null;
};

export const compatJobSelect = {
  id: true,
  provider: true,
  status: true,
  stage: true,
  attempt: true,
  maxAttempts: true,
  progress: true,
  nextAttemptAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
} as const;

export function toCompatJobView(job: CompatJobRecord): CompatJobView {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
    lastErrorCode: job.lastErrorCode,
    lastErrorMessage: job.lastErrorMessage,
  };
}
