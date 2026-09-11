import type {
  EnrichmentJobStage,
  EnrichmentJobStatus,
} from "@/generated/prisma/client";

export const IGDB_JOB_MAX_ATTEMPTS = 3 as const;

const IGDB_JOB_PROGRESS = {
  MATCHING: 25,
  PERSISTING: 75,
  RETRYING: 25,
  COMPLETE: 100,
  FAILED: 0,
} satisfies Record<EnrichmentJobStage, number>;

const VALID_TRANSITIONS: Record<
  EnrichmentJobStatus,
  readonly EnrichmentJobStatus[]
> = {
  QUEUED: ["RUNNING", "FAILED"],
  RUNNING: ["RETRY_WAIT", "AWAITING_MATCH", "SUCCEEDED", "FAILED"],
  RETRY_WAIT: ["RUNNING", "FAILED"],
  AWAITING_MATCH: ["QUEUED", "FAILED"],
  SUCCEEDED: ["QUEUED"],
  FAILED: ["QUEUED"],
};

export interface IgdbJobState {
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: Date | null;
}

export function initialIgdbJobState(): IgdbJobState {
  return {
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 0,
    maxAttempts: IGDB_JOB_MAX_ATTEMPTS,
    progress: 0,
    nextAttemptAt: null,
  };
}

export function canTransitionIgdbJob(
  current: EnrichmentJobStatus,
  next: EnrichmentJobStatus,
): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

export function assertIgdbJobTransition(
  current: EnrichmentJobStatus,
  next: EnrichmentJobStatus,
): void {
  if (!canTransitionIgdbJob(current, next)) {
    throw new Error(`Invalid IGDB job transition: ${current} -> ${next}`);
  }
}

export function igdbJobProgress(stage: EnrichmentJobStage): number {
  return IGDB_JOB_PROGRESS[stage];
}

export function isActiveIgdbJobStatus(
  status: EnrichmentJobStatus,
): boolean {
  return ["QUEUED", "RUNNING", "RETRY_WAIT", "AWAITING_MATCH"].includes(status);
}
