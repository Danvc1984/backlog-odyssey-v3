"use server";

import { z } from "zod";
import { friendlyActionError } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { COMPAT_JOB_MAX_ATTEMPTS, compatJobSelect, toCompatJobView } from "@/lib/compat-job";
import { runCompatJob } from "@/lib/compat-job-runner";

const refreshSchema = z.object({ gameId: z.string().trim().min(1) }).strict();
const overrideSchema = z.object({
  gameId: z.string().trim().min(1),
  status: z.enum(["READY", "READY_WITH_TINKERING", "FALLBACK_RECOMMENDED", "REQUIRED", "UNKNOWN"]).nullable(),
  reason: z.string().trim().max(500).nullable(),
}).strict();

const activeStatuses = new Set(["QUEUED", "RUNNING", "RETRY_WAIT"]);

export async function refreshGameCompatibility(input: unknown) {
  try {
    await requireUser();
    const parsed = refreshSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };

    const game = await prisma.game.findUnique({
      where: { id: parsed.data.gameId },
      select: { id: true, libraryEntry: { select: { hidden: true } } },
    });
    if (!game) return { success: false as const, data: null, error: "Game not found" };
    if (game.libraryEntry?.hidden === true) {
      return { success: false as const, data: null, error: "Hidden games are not eligible for compatibility refresh" };
    }

    const existing = await prisma.enrichmentJob.findUnique({
      where: { gameId_provider: { gameId: game.id, provider: "PROTONDB" } },
      select: compatJobSelect,
    });
    if (existing && activeStatuses.has(existing.status)) {
      return { success: true as const, data: toCompatJobView(existing), error: null };
    }

    const jobData = {
      status: "QUEUED" as const,
      stage: "MATCHING" as const,
      attempt: 0,
      maxAttempts: COMPAT_JOB_MAX_ATTEMPTS,
      progress: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
    };
    const job = existing
      ? await prisma.enrichmentJob.update({ where: { id: existing.id }, data: jobData, select: compatJobSelect })
      : await prisma.enrichmentJob.create({
          data: { ...jobData, gameId: game.id, provider: "PROTONDB" },
          select: compatJobSelect,
        });
    return { success: true as const, data: (await runCompatJob(job.id))?.data ?? toCompatJobView(job), error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to refresh compatibility"),
    };
  }
}

export async function setCompatOverride(input: unknown) {
  try {
    await requireUser();
    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };

    const libraryEntry = await prisma.libraryEntry.findUnique({
      where: { gameId: parsed.data.gameId },
      select: { id: true },
    });
    if (!libraryEntry) {
      return { success: false as const, data: null, error: "Game is not in the library" };
    }

    const updated = await prisma.libraryEntry.update({
      where: { gameId: parsed.data.gameId },
      data: {
        compatOverrideStatus: parsed.data.status,
        compatOverrideReason: parsed.data.status ? parsed.data.reason || null : null,
      },
    });
    return { success: true as const, data: updated, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to save compatibility override"),
    };
  }
}
