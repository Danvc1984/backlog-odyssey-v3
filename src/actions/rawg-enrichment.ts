"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  isActiveRawgJobStatus,
  RAWG_JOB_MAX_ATTEMPTS,
} from "@/lib/rawg-job";
import {
  candidatesFromPayload,
  candidatePageFromPayload,
  rawgJobSelect,
  toRawgEnrichmentJobView,
} from "@/lib/rawg-job-view";
import { RAWG_SEARCH_PAGE_SIZE, searchRawgCandidates } from "@/lib/rawg-api";

const requestRawgEnrichmentSchema = z
  .object({
    gameId: z.string().trim().min(1),
    confirmOverwrite: z.boolean().default(false),
  })
  .strict();

const selectRawgMatchSchema = z
  .object({
    jobId: z.string().trim().min(1),
    rawgId: z.number().int().positive(),
  })
  .strict();

const cancelRawgEnrichmentSchema = z
  .object({
    jobId: z.string().trim().min(1),
  })
  .strict();

const applyRawgTitleSchema = z
  .object({
    gameId: z.string().trim().min(1),
  })
  .strict();

const loadMoreRawgCandidatesSchema = z
  .object({
    jobId: z.string().trim().min(1),
  })
  .strict();

const rawgMetadataTitleSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export type RequestRawgEnrichmentInput = z.input<
  typeof requestRawgEnrichmentSchema
>;

export type SelectRawgMatchInput = z.infer<typeof selectRawgMatchSchema>;

export type CancelRawgEnrichmentInput = z.infer<typeof cancelRawgEnrichmentSchema>;

export type ApplyRawgTitleInput = z.infer<typeof applyRawgTitleSchema>;

export type LoadMoreRawgCandidatesInput = z.infer<
  typeof loadMoreRawgCandidatesSchema
>;

function queuedJobData() {
  return {
    status: "QUEUED" as const,
    stage: "MATCHING" as const,
    attempt: 0,
    maxAttempts: RAWG_JOB_MAX_ATTEMPTS,
    progress: 0,
    nextAttemptAt: null,
    candidatePayload: Prisma.DbNull,
    selectedRawgId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
  };
}

export async function requestRawgEnrichment(
  input: RequestRawgEnrichmentInput,
) {
  try {
    await requireUser();
    const parsed = requestRawgEnrichmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { gameId, confirmOverwrite } = parsed.data;
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        metadataSnapshots: {
          where: { provider: "RAWG" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { fetchedAt: true },
        },
      },
    });

    if (!game) {
      return { success: false as const, data: null, error: "Game not found" };
    }

    const existingJob = await prisma.enrichmentJob.findUnique({
      where: { gameId_provider: { gameId, provider: "RAWG" } },
      select: rawgJobSelect,
    });

    if (existingJob && isActiveRawgJobStatus(existingJob.status)) {
      return {
        success: true as const,
        data: { kind: "JOB" as const, job: toRawgEnrichmentJobView(existingJob) },
        error: null,
      };
    }

    const existingSnapshot = game.metadataSnapshots[0];
    if (existingSnapshot && !confirmOverwrite) {
      return {
        success: true as const,
        data: {
          kind: "OVERWRITE_REQUIRED" as const,
          existingFetchedAt: existingSnapshot.fetchedAt.toISOString(),
        },
        error: null,
      };
    }

    const data = queuedJobData();
    const job = existingJob
      ? await prisma.enrichmentJob.update({
          where: { id: existingJob.id },
          data,
          select: rawgJobSelect,
        })
      : await prisma.enrichmentJob.create({
          data: { ...data, gameId, provider: "RAWG" },
          select: rawgJobSelect,
        });

    return {
      success: true as const,
      data: { kind: "JOB" as const, job: toRawgEnrichmentJobView(job) },
      error: null,
    };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to queue RAWG enrichment",
    };
  }
}

export async function selectRawgMatch(input: SelectRawgMatchInput) {
  try {
    await requireUser();
    const parsed = selectRawgMatchSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const job = await prisma.enrichmentJob.findUnique({
      where: { id: parsed.data.jobId },
      select: rawgJobSelect,
    });

    if (!job || job.provider !== "RAWG") {
      return { success: false as const, data: null, error: "RAWG job not found" };
    }
    if (job.status !== "AWAITING_MATCH") {
      return {
        success: false as const,
        data: null,
        error: "RAWG job is not awaiting match selection",
      };
    }

    const candidates = candidatesFromPayload(job.candidatePayload);
    if (!candidates.some((candidate) => candidate.id === parsed.data.rawgId)) {
      return {
        success: false as const,
        data: null,
        error: "RAWG candidate is not available for this job",
      };
    }

    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        stage: "MATCHING",
        attempt: 0,
        progress: 0,
        nextAttemptAt: null,
        selectedRawgId: parsed.data.rawgId,
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
      select: rawgJobSelect,
    });

    return {
      success: true as const,
      data: { kind: "JOB" as const, job: toRawgEnrichmentJobView(updated) },
      error: null,
    };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to select RAWG match",
    };
  }
}

export async function cancelRawgEnrichment(input: CancelRawgEnrichmentInput) {
  try {
    await requireUser();
    const parsed = cancelRawgEnrichmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const job = await prisma.enrichmentJob.findUnique({
      where: { id: parsed.data.jobId },
      select: rawgJobSelect,
    });
    if (!job || job.provider !== "RAWG") {
      return { success: false as const, data: null, error: "RAWG job not found" };
    }
    if (job.status !== "AWAITING_MATCH") {
      return {
        success: false as const,
        data: null,
        error: "RAWG job is not awaiting match selection",
      };
    }

    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        stage: "FAILED",
        nextAttemptAt: null,
        candidatePayload: Prisma.DbNull,
        selectedRawgId: null,
        lastErrorCode: "CANCELLED",
        lastErrorMessage: "RAWG match review was cancelled",
        finishedAt: new Date(),
      },
      select: rawgJobSelect,
    });

    return {
      success: true as const,
      data: { kind: "JOB" as const, job: toRawgEnrichmentJobView(updated) },
      error: null,
    };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to cancel RAWG enrichment",
    };
  }
}

export async function loadMoreRawgCandidates(
  input: LoadMoreRawgCandidatesInput,
) {
  try {
    await requireUser();
    const parsed = loadMoreRawgCandidatesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const job = await prisma.enrichmentJob.findUnique({
      where: { id: parsed.data.jobId },
      select: {
        ...rawgJobSelect,
        game: { select: { name: true } },
      },
    });
    if (!job || job.provider !== "RAWG") {
      return { success: false as const, data: null, error: "RAWG job not found" };
    }
    if (job.status !== "AWAITING_MATCH") {
      return {
        success: false as const,
        data: null,
        error: "RAWG job is not awaiting match selection",
      };
    }

    const candidatePage = candidatePageFromPayload(job.candidatePayload);
    if (!candidatePage.nextPage) {
      return { success: false as const, data: null, error: "No more RAWG matches" };
    }

    const candidates = await searchRawgCandidates(job.game.name, candidatePage.nextPage);
    if (!Array.isArray(candidates)) {
      return {
        success: false as const,
        data: null,
        error: "RAWG could not load more matches",
      };
    }

    const knownIds = new Set(candidatePage.candidates.map((candidate) => candidate.id));
    const allCandidates = [
      ...candidatePage.candidates,
      ...candidates.filter((candidate) => !knownIds.has(candidate.id)),
    ];
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        candidatePayload: {
          candidates: allCandidates,
          nextPage:
            candidates.length === RAWG_SEARCH_PAGE_SIZE
              ? candidatePage.nextPage + 1
              : null,
        } as unknown as Prisma.InputJsonValue,
      },
      select: rawgJobSelect,
    });

    return {
      success: true as const,
      data: { kind: "JOB" as const, job: toRawgEnrichmentJobView(updated) },
      error: null,
    };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to load more RAWG matches",
    };
  }
}

export async function applyRawgTitle(input: ApplyRawgTitleInput) {
  try {
    await requireUser();
    const parsed = applyRawgTitleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const game = await prisma.game.findUnique({
      where: { id: parsed.data.gameId },
      select: {
        id: true,
        metadataSnapshots: {
          where: { provider: "RAWG" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    });
    if (!game) {
      return { success: false as const, data: null, error: "Game not found" };
    }

    const snapshot = game.metadataSnapshots[0];
    const metadata = snapshot ? rawgMetadataTitleSchema.safeParse(snapshot.payload) : null;
    if (!metadata?.success) {
      return { success: false as const, data: null, error: "RAWG title is unavailable" };
    }

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { name: metadata.data.title },
      select: { id: true, name: true },
    });
    return { success: true as const, data: updated, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to apply RAWG title",
    };
  }
}
