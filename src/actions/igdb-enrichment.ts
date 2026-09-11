"use server";

import { Prisma } from "@/generated/prisma/client";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  IGDB_JOB_MAX_ATTEMPTS,
  isActiveIgdbJobStatus,
} from "@/lib/igdb-job";
import {
  candidatesFromIgdbPayload,
  candidatePageFromIgdbPayload,
  igdbJobSelect,
  toIgdbEnrichmentJobView,
} from "@/lib/igdb-job-view";
import { IGDB_SEARCH_PAGE_SIZE, searchIgdbCandidatePage } from "@/lib/igdb-api";
import type { IgdbSearchCandidate } from "@/lib/igdb-types";
import { z } from "zod";

const requestSchema = z.object({ gameId: z.string().trim().min(1), confirmOverwrite: z.boolean().default(false) }).strict();
const reviewSchema = z.object({ gameId: z.string().trim().min(1), title: z.string().trim().min(1).max(200).optional() }).strict();
const selectSchema = z.object({ jobId: z.string().trim().min(1), igdbId: z.number().int().positive() }).strict();
const jobSchema = z.object({ jobId: z.string().trim().min(1) }).strict();
const titleSchema = z.object({ gameId: z.string().trim().min(1) }).strict();
const metadataTitleSchema = z.object({ name: z.string().trim().min(1).max(200) });

export type RequestIgdbEnrichmentInput = z.input<typeof requestSchema>;
export type RequestIgdbMatchReviewInput = z.infer<typeof reviewSchema>;
export type SelectIgdbMatchInput = z.infer<typeof selectSchema>;
export type IgdbJobInput = z.infer<typeof jobSchema>;
export type ApplyIgdbTitleInput = z.infer<typeof titleSchema>;

function queuedJobData() {
  return {
    status: "QUEUED" as const,
    stage: "MATCHING" as const,
    attempt: 0,
    maxAttempts: IGDB_JOB_MAX_ATTEMPTS,
    progress: 0,
    nextAttemptAt: null,
    candidatePayload: Prisma.DbNull,
    selectedIgdbId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
  };
}

function candidatePayload(candidates: IgdbSearchCandidate[], offset: number, searchTerm: string | null) {
  return {
    candidates,
    nextPage: candidates.length === IGDB_SEARCH_PAGE_SIZE ? offset + IGDB_SEARCH_PAGE_SIZE : null,
    ...(searchTerm ? { searchTerm } : {}),
  } as unknown as Prisma.InputJsonValue;
}

export async function requestIgdbMatchReview(input: RequestIgdbMatchReviewInput) {
  try {
    await requireUser();
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const game = await prisma.game.findUnique({
      where: { id: parsed.data.gameId },
      select: { id: true, name: true, libraryEntry: { select: { hidden: true } } },
    });
    if (!game) return { success: false as const, data: null, error: "Game not found" };
    if (game.libraryEntry?.hidden === true) return { success: false as const, data: null, error: "Hidden games are not eligible for IGDB enrichment" };
    const search = await searchIgdbCandidatePage(parsed.data.title ?? game.name, { offset: 0 });
    if (!search.ok) return { success: false as const, data: null, error: "IGDB could not search matches" };
    const data = {
      status: "AWAITING_MATCH" as const,
      stage: "MATCHING" as const,
      attempt: 0,
      progress: 25,
      candidatePayload: candidatePayload(search.data, 0, search.searchTerm ?? null),
      selectedIgdbId: null,
      nextAttemptAt: null,
      lastErrorCode: "AMBIGUOUS",
      lastErrorMessage: "Select an IGDB match to continue",
      startedAt: null,
      finishedAt: null,
    };
    const existing = await prisma.enrichmentJob.findUnique({ where: { gameId_provider: { gameId: game.id, provider: "IGDB" } }, select: { id: true } });
    const job = existing
      ? await prisma.enrichmentJob.update({ where: { id: existing.id }, data, select: igdbJobSelect })
      : await prisma.enrichmentJob.create({ data: { ...data, gameId: game.id, provider: "IGDB", maxAttempts: IGDB_JOB_MAX_ATTEMPTS }, select: igdbJobSelect });
    return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(job) }, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to search IGDB matches") };
  }
}

export async function requestIgdbEnrichment(input: RequestIgdbEnrichmentInput) {
  try {
    await requireUser();
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const game = await prisma.game.findUnique({
      where: { id: parsed.data.gameId },
      select: {
        id: true,
        libraryEntry: { select: { hidden: true } },
        metadataSnapshots: { where: { provider: "IGDB" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { fetchedAt: true } },
      },
    });
    if (!game) return { success: false as const, data: null, error: "Game not found" };
    if (game.libraryEntry?.hidden === true) return { success: false as const, data: null, error: "Hidden games are not eligible for IGDB enrichment" };
    const existingJob = await prisma.enrichmentJob.findUnique({ where: { gameId_provider: { gameId: game.id, provider: "IGDB" } }, select: igdbJobSelect });
    if (existingJob && isActiveIgdbJobStatus(existingJob.status)) return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(existingJob) }, error: null };
    const snapshot = game.metadataSnapshots[0];
    if (snapshot && !parsed.data.confirmOverwrite) return { success: true as const, data: { kind: "OVERWRITE_REQUIRED" as const, existingFetchedAt: snapshot.fetchedAt.toISOString() }, error: null };
    const data = queuedJobData();
    const job = existingJob
      ? await prisma.enrichmentJob.update({ where: { id: existingJob.id }, data, select: igdbJobSelect })
      : await prisma.enrichmentJob.create({ data: { ...data, gameId: game.id, provider: "IGDB" }, select: igdbJobSelect });
    return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(job) }, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to queue IGDB enrichment") };
  }
}

export async function selectIgdbMatch(input: SelectIgdbMatchInput) {
  try {
    await requireUser();
    const parsed = selectSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const job = await prisma.enrichmentJob.findUnique({ where: { id: parsed.data.jobId }, select: igdbJobSelect });
    if (!job || job.provider !== "IGDB") return { success: false as const, data: null, error: "IGDB job not found" };
    if (job.status !== "AWAITING_MATCH") return { success: false as const, data: null, error: "IGDB job is not awaiting match selection" };
    if (!candidatesFromIgdbPayload(job.candidatePayload).some((candidate) => candidate.id === parsed.data.igdbId)) return { success: false as const, data: null, error: "IGDB candidate is not available for this job" };
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", stage: "MATCHING", attempt: 0, progress: 0, nextAttemptAt: null, selectedIgdbId: parsed.data.igdbId, lastErrorCode: null, lastErrorMessage: null, startedAt: null, finishedAt: null },
      select: igdbJobSelect,
    });
    return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(updated) }, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to select IGDB match") };
  }
}

export async function cancelIgdbEnrichment(input: IgdbJobInput) {
  try {
    await requireUser();
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const job = await prisma.enrichmentJob.findUnique({ where: { id: parsed.data.jobId }, select: igdbJobSelect });
    if (!job || job.provider !== "IGDB") return { success: false as const, data: null, error: "IGDB job not found" };
    if (job.status !== "AWAITING_MATCH") return { success: false as const, data: null, error: "IGDB job is not awaiting match selection" };
    const updated = await prisma.enrichmentJob.update({ where: { id: job.id }, data: { status: "FAILED", stage: "FAILED", nextAttemptAt: null, candidatePayload: Prisma.DbNull, selectedIgdbId: null, lastErrorCode: "CANCELLED", lastErrorMessage: "IGDB match review was cancelled", finishedAt: new Date() }, select: igdbJobSelect });
    return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(updated) }, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to cancel IGDB enrichment") };
  }
}

export async function loadMoreIgdbCandidates(input: IgdbJobInput) {
  try {
    await requireUser();
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const job = await prisma.enrichmentJob.findUnique({ where: { id: parsed.data.jobId }, select: { ...igdbJobSelect, game: { select: { name: true } } } });
    if (!job || job.provider !== "IGDB") return { success: false as const, data: null, error: "IGDB job not found" };
    if (job.status !== "AWAITING_MATCH") return { success: false as const, data: null, error: "IGDB job is not awaiting match selection" };
    const page = candidatePageFromIgdbPayload(job.candidatePayload);
    if (page.nextPage === null) return { success: false as const, data: null, error: "No more IGDB matches" };
    const search = await searchIgdbCandidatePage(job.game.name, { offset: page.nextPage, searchTerm: page.searchTerm ?? undefined });
    if (!search.ok) return { success: false as const, data: null, error: "IGDB could not load more matches" };
    const known = new Set(page.candidates.map((candidate) => candidate.id));
    const all = [...page.candidates, ...search.data.filter((candidate) => !known.has(candidate.id))];
    const updated = await prisma.enrichmentJob.update({ where: { id: job.id }, data: { candidatePayload: candidatePayload(all, page.nextPage, page.searchTerm) }, select: igdbJobSelect });
    return { success: true as const, data: { kind: "JOB" as const, job: toIgdbEnrichmentJobView(updated) }, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to load more IGDB matches") };
  }
}

export async function applyIgdbTitle(input: ApplyIgdbTitleInput) {
  try {
    await requireUser();
    const parsed = titleSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const game = await prisma.game.findUnique({ where: { id: parsed.data.gameId }, select: { id: true, libraryEntry: { select: { hidden: true } }, metadataSnapshots: { where: { provider: "IGDB" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { payload: true } } } });
    if (!game) return { success: false as const, data: null, error: "Game not found" };
    if (game.libraryEntry?.hidden === true) return { success: false as const, data: null, error: "Hidden games are not eligible for IGDB enrichment" };
    const metadata = game.metadataSnapshots[0] ? metadataTitleSchema.safeParse(game.metadataSnapshots[0].payload) : null;
    if (!metadata?.success) return { success: false as const, data: null, error: "IGDB title is unavailable" };
    const updated = await prisma.game.update({ where: { id: game.id }, data: { name: metadata.data.name }, select: { id: true, name: true } });
    return { success: true as const, data: updated, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to apply IGDB title") };
  }
}
