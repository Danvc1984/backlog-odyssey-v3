import { z } from "zod";
import type {
  EnrichmentJobStage,
  EnrichmentJobStatus,
} from "@/generated/prisma/client";
import type { IgdbSearchCandidate } from "./igdb-types";

const igdbCandidateSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  alternativeNames: z.array(z.string()),
  category: z.number().int().nullable(),
  firstReleaseDate: z.string().nullable(),
  coverUrl: z.string().nullable(),
  score: z.number().finite().optional(),
});

const igdbCandidatePayloadSchema = z.object({
  candidates: z.array(igdbCandidateSchema),
  nextPage: z.number().int().nonnegative().nullable(),
  searchTerm: z.string().nullable().optional(),
});

export interface IgdbCandidatePage {
  candidates: IgdbSearchCandidate[];
  nextPage: number | null;
  searchTerm: string | null;
}

export interface IgdbEnrichmentJobView {
  id: string;
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: string | null;
  candidates: IgdbSearchCandidate[];
  hasMoreCandidates: boolean;
  selectedIgdbId: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export type IgdbJobRecord = {
  id: string;
  provider: string;
  status: EnrichmentJobStatus;
  stage: EnrichmentJobStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  nextAttemptAt: Date | null;
  candidatePayload: unknown;
  selectedIgdbId: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export const igdbJobSelect = {
  id: true,
  provider: true,
  status: true,
  stage: true,
  attempt: true,
  maxAttempts: true,
  progress: true,
  nextAttemptAt: true,
  candidatePayload: true,
  selectedIgdbId: true,
  lastErrorCode: true,
  lastErrorMessage: true,
} as const;

export function candidatePageFromIgdbPayload(payload: unknown): IgdbCandidatePage {
  const parsed = igdbCandidatePayloadSchema.safeParse(payload);
  if (parsed.success) return { ...parsed.data, searchTerm: parsed.data.searchTerm ?? null };

  const legacy = z.array(igdbCandidateSchema).safeParse(payload);
  return legacy.success
    ? { candidates: legacy.data, nextPage: legacy.data.length >= 10 ? 10 : null, searchTerm: null }
    : { candidates: [], nextPage: null, searchTerm: null };
}

export function candidatesFromIgdbPayload(payload: unknown): IgdbSearchCandidate[] {
  return candidatePageFromIgdbPayload(payload).candidates;
}

export function toIgdbEnrichmentJobView(
  job: IgdbJobRecord,
): IgdbEnrichmentJobView {
  const candidatePage = candidatePageFromIgdbPayload(job.candidatePayload);
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
    selectedIgdbId: job.selectedIgdbId,
    lastErrorCode: job.lastErrorCode,
    lastErrorMessage: job.lastErrorMessage,
  };
}
