"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { friendlyActionError } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import { runRawgEnrichmentJob } from "@/lib/rawg-job-runner";
import { runCompatJob } from "@/lib/compat-job-runner";

const retryInputSchema = z.object({ jobId: z.string().min(1) }).strict();

const RETRYABLE_PROVIDERS = ["RAWG", "PROTONDB", "ARE_WE_ANTICHEAT_YET"] as const;

export async function retryEnrichmentJob(input: unknown) {
  try {
    await requireUser();
    const parsed = retryInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { jobId } = parsed.data;
    const job = await prisma.enrichmentJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        provider: true,
        status: true,
        stage: true,
        attempt: true,
        maxAttempts: true,
        nextAttemptAt: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        candidatePayload: true,
        selectedRawgId: true,
        finishedAt: true,
      },
    });

    if (!job) {
      return { success: false as const, data: null, error: "Enrichment job not found" };
    }
    if (job.status !== "FAILED") {
      return { success: false as const, data: null, error: "Only failed jobs can be retried" };
    }
    if (!(RETRYABLE_PROVIDERS as readonly string[]).includes(job.provider)) {
      return { success: false as const, data: null, error: "Retry is not available for this provider" };
    }

    const requeued = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        attempt: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      select: { id: true },
    });

    const runResult =
      job.provider === "RAWG"
        ? await runRawgEnrichmentJob(requeued.id)
        : await runCompatJob(requeued.id);

    return { success: true as const, data: runResult, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to retry enrichment job"),
    };
  }
}
