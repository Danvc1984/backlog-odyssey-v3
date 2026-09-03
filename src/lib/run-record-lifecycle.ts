import "server-only";

import { Prisma } from "@/generated/prisma/client";

export const ABANDONED_RUN_MS = 15 * 60 * 1000;

interface RunRecord {
  id: string;
}

interface RunDelegate {
  findFirst(args: object): Promise<RunRecord | null>;
  updateMany(args: object): Promise<unknown>;
  create(args: object): Promise<RunRecord>;
  update(args: object): Promise<unknown>;
}

export type StartSingleRunResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "already-running"; runId: string };

export async function recoverAbandonedRun(
  delegate: RunDelegate,
  now: Date,
  timestampField: string,
): Promise<void> {
  const cutoff = new Date(now.getTime() - ABANDONED_RUN_MS);
  const abandoned = await delegate.findFirst({
    where: { status: "RUNNING", [timestampField]: { lt: cutoff } },
    select: { id: true },
  });
  if (!abandoned) {
    return;
  }
  await delegate.updateMany({
    where: { id: abandoned.id, status: "RUNNING" },
    data: { status: "FAILED", finishedAt: now },
  });
}

export async function startSingleRun(
  delegate: RunDelegate,
  createData: object,
  activeWhere: object,
): Promise<StartSingleRunResult> {
  try {
    const run = await delegate.create({ data: createData, select: { id: true } });
    return { ok: true, runId: run.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const active = await delegate.findFirst({ where: activeWhere, select: { id: true } });
      if (active) {
        return { ok: false, reason: "already-running", runId: active.id };
      }
    }
    throw error;
  }
}

export async function finalizeRun<TCounts>(
  delegate: RunDelegate,
  runId: string,
  counts: TCounts,
  statusFromCounts: (counts: TCounts) => string,
): Promise<void> {
  await delegate.update({
    where: { id: runId },
    data: {
      status: statusFromCounts(counts),
      counts: counts as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });
}
