import { z } from "zod";
import type {
  EnrichmentJobStage,
  EnrichmentJobStatus,
} from "@/generated/prisma/client";
import type { RawgSearchCandidate } from "@/lib/rawg-types";

const rawgCandidateSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable(),
  backgroundImage: z.string().nullable(),
});

const rawgCandidateListSchema = z.array(rawgCandidateSchema);
const rawgCandidatePayloadSchema = z.object({
  candidates: rawgCandidateListSchema,
  nextPage: z.number().int().positive().nullable(),
});

export interface RawgCandidatePage {
  candidates: RawgSearchCandidate[];
  nextPage: number | null;
}

export interface RawgEnrichmentJobView {
  id: string;
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: string | null;
  candidates: RawgSearchCandidate[];
  hasMoreCandidates: boolean;
  selectedRawgId: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export type RawgJobRecord = {
  id: string;
  provider: string;
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: Date | null;
  candidatePayload: unknown;
  selectedRawgId: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export const rawgJobSelect = {
  id: true,
  provider: true,
  status: true,
  stage: true,
  attempt: true,
  maxAttempts: true,
  progress: true,
  nextAttemptAt: true,
  candidatePayload: true,
  selectedRawgId: true,
  lastErrorCode: true,
  lastErrorMessage: true,
} as const;

export function candidatePageFromPayload(payload: unknown): RawgCandidatePage {
  const paged = rawgCandidatePayloadSchema.safeParse(payload);
  if (paged.success) {
    return paged.data;
  }

  const legacy = rawgCandidateListSchema.safeParse(payload);
  return legacy.success
    ? { candidates: legacy.data, nextPage: legacy.data.length > 0 ? 2 : null }
    : { candidates: [], nextPage: null };
}

export function candidatesFromPayload(payload: unknown): RawgSearchCandidate[] {
  return candidatePageFromPayload(payload).candidates;
}

export function toRawgEnrichmentJobView(
  job: RawgJobRecord,
): RawgEnrichmentJobView {
  const candidatePage = candidatePageFromPayload(job.candidatePayload);
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    nextAttemptAt: job.nextAttemptAt?.toISOString() ?? null,
    candidates: candidatePage.candidates,
    hasMoreCandidates: candidatePage.nextPage !== null,
    selectedRawgId: job.selectedRawgId,
    lastErrorCode: job.lastErrorCode,
    lastErrorMessage: job.lastErrorMessage,
  };
}
