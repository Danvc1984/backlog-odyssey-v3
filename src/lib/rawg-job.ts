import type {
  EnrichmentJobStage,
  EnrichmentJobStatus,
} from "@/generated/prisma/client";

export const RAWG_JOB_MAX_ATTEMPTS = 3 as const;

const RAWG_JOB_PROGRESS = {
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

export interface RawgJobState {
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: Date | null;
}

export function initialRawgJobState(): RawgJobState {
  return {
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 0,
    maxAttempts: RAWG_JOB_MAX_ATTEMPTS,
    progress: 0,
    nextAttemptAt: null,
  };
}

export function canTransitionRawgJob(
  current: EnrichmentJobStatus,
  next: EnrichmentJobStatus,
): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

export function assertRawgJobTransition(
  current: EnrichmentJobStatus,
  next: EnrichmentJobStatus,
): void {
  if (!canTransitionRawgJob(current, next)) {
    throw new Error(`Invalid RAWG job transition: ${current} -> ${next}`);
  }
}

export function rawgJobProgress(stage: EnrichmentJobStage): number {
  return RAWG_JOB_PROGRESS[stage];
}

export function isActiveRawgJobStatus(
  status: EnrichmentJobStatus,
): boolean {
  return ["QUEUED", "RUNNING", "RETRY_WAIT", "AWAITING_MATCH"].includes(status);
}
