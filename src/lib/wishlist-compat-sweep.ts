import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getWishlistCompatibilityEligibility,
  WISHLIST_COMPAT_FRESHNESS_DAYS,
} from "@/lib/wishlist-compatibility";
import { runWishlistCompatibilityRefresh } from "@/lib/wishlist-compatibility-runner";

export interface WishlistCompatSweepCounts {
  total: number;
  refreshed: number;
  upToDate: number;
  failed: number;
}

export interface WishlistCompatSweepEntryInput {
  id: string;
  createdAt: Date;
  type: string;
  steamAppId: string | null;
  steamAppIdProvenance: string | null;
}

export type WishlistCompatSweepEntryDecision =
  | { kind: "refresh" }
  | { kind: "upToDate" }
  | { kind: "skip"; reason: "DLC" | "STEAM_ID_REQUIRED" | "STEAM_ID_PROVENANCE_REQUIRED" };

export function classifyWishlistCompatEntry(
  entry: WishlistCompatSweepEntryInput,
  snapshotFetchedAts: readonly Date[],
  now: Date = new Date(),
): WishlistCompatSweepEntryDecision {
  const eligibility = getWishlistCompatibilityEligibility(entry);
  if (!eligibility.eligible) {
    return { kind: "skip", reason: eligibility.reason };
  }
  const cutoff = new Date(now.getTime() - WISHLIST_COMPAT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  const hasFreshEvidence = snapshotFetchedAts.some(
    (fetchedAt) => fetchedAt.getTime() >= cutoff.getTime(),
  );
  return hasFreshEvidence ? { kind: "upToDate" } : { kind: "refresh" };
}

export function sweepStatusFromCounts(
  counts: WishlistCompatSweepCounts,
): "SUCCESS" | "PARTIAL" | "FAILED" {
  const attempts = counts.refreshed + counts.failed;
  if (attempts > 0 && counts.refreshed === 0) return "FAILED";
  if (counts.failed > 0) return "PARTIAL";
  return "SUCCESS";
}

export const ABANDONED_RUN_MS = 15 * 60 * 1000;

export function emptySweepCounts(total = 0, upToDate = 0): WishlistCompatSweepCounts {
  return { total, refreshed: 0, upToDate, failed: 0 };
}

async function recoverAbandonedRuns(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - ABANDONED_RUN_MS);
  const abandoned = await prisma.wishlistCompatSweep.findFirst({
    where: { status: "RUNNING", requestedAt: { lt: cutoff } },
    select: { id: true },
  });
  if (!abandoned) {
    return;
  }
  await prisma.wishlistCompatSweep.updateMany({
    where: { id: abandoned.id, status: "RUNNING" },
    data: { status: "FAILED", finishedAt: now },
  });
}

export type StartWishlistCompatSweepResult =
  | { ok: true; runId: string; total: number; upToDate: number; refreshIds: string[] }
  | { ok: false; reason: "already-running"; runId: string };

export async function startWishlistCompatSweep(
  now: Date = new Date(),
): Promise<StartWishlistCompatSweepResult> {
  await recoverAbandonedRuns(now);

  const entries = await prisma.wishlistEntry.findMany({
    where: {
      type: "BASE_GAME",
      steamAppId: { not: null },
      steamAppIdProvenance: { not: null },
    },
    select: {
      id: true,
      createdAt: true,
      type: true,
      steamAppId: true,
      steamAppIdProvenance: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const snapshotRows =
    entries.length > 0
      ? await prisma.wishlistCompatibilitySnapshot.findMany({
          where: { wishlistEntryId: { in: entries.map((entry) => entry.id) } },
          select: { wishlistEntryId: true, fetchedAt: true },
        })
      : [];

  const fetchedByEntry = new Map<string, Date[]>();
  for (const row of snapshotRows) {
    const list = fetchedByEntry.get(row.wishlistEntryId) ?? [];
    list.push(row.fetchedAt);
    fetchedByEntry.set(row.wishlistEntryId, list);
  }

  const refreshIds: string[] = [];
  let upToDate = 0;
  for (const entry of entries) {
    const decision = classifyWishlistCompatEntry(
      {
        id: entry.id,
        createdAt: entry.createdAt,
        type: entry.type,
        steamAppId: entry.steamAppId,
        steamAppIdProvenance: entry.steamAppIdProvenance,
      },
      fetchedByEntry.get(entry.id) ?? [],
      now,
    );
    if (decision.kind === "refresh") refreshIds.push(entry.id);
    else if (decision.kind === "upToDate") upToDate += 1;
  }

  const counts = emptySweepCounts(entries.length, upToDate);
  try {
    const run = await prisma.wishlistCompatSweep.create({
      data: {
        status: "RUNNING",
        counts: counts as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { ok: true, runId: run.id, total: entries.length, upToDate, refreshIds };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const active = await prisma.wishlistCompatSweep.findFirst({
        where: { status: "RUNNING" },
        select: { id: true },
      });
      if (active) {
        return { ok: false, reason: "already-running", runId: active.id };
      }
    }
    throw error;
  }
}

export async function processWishlistCompatSweepEntries(
  refreshIds: readonly string[],
): Promise<{ refreshed: number; failed: number }> {
  let refreshed = 0;
  let failed = 0;
  for (const id of refreshIds) {
    try {
      const result = await runWishlistCompatibilityRefresh(id);
      if (result.success) refreshed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { refreshed, failed };
}

export async function finalizeWishlistCompatSweep(
  runId: string,
  counts: WishlistCompatSweepCounts,
): Promise<void> {
  await prisma.wishlistCompatSweep.update({
    where: { id: runId },
    data: {
      status: sweepStatusFromCounts(counts),
      counts: counts as unknown as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });
}

export type RunWishlistCompatSweepResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "already-running"; runId: string };

export async function runWishlistCompatSweep(): Promise<RunWishlistCompatSweepResult> {
  const started = await startWishlistCompatSweep();
  if (!started.ok) {
    return started;
  }

  try {
    const processed = await processWishlistCompatSweepEntries(started.refreshIds);
    await finalizeWishlistCompatSweep(started.runId, {
      total: started.total,
      refreshed: processed.refreshed,
      upToDate: started.upToDate,
      failed: processed.failed,
    });
    return { ok: true, runId: started.runId };
  } catch {
    await finalizeWishlistCompatSweep(started.runId, {
      total: started.total,
      refreshed: 0,
      upToDate: started.upToDate,
      failed: started.refreshIds.length,
    });
    return { ok: true, runId: started.runId };
  }
}