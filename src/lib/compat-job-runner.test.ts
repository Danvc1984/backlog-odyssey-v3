import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/protondb-api", () => ({ lookupProtonDb: vi.fn(), PROTONDB_URL: "https://protondb.test" }));
vi.mock("@/lib/away-api", () => ({ lookupAway: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { lookupAway } from "@/lib/away-api";
import { lookupProtonDb } from "@/lib/protondb-api";
import { runCompatJob } from "./compat-job-runner";

const snapshotUpsert = vi.fn();
const environmentUpsert = vi.fn();
const updateMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const transaction = vi.fn();

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    provider: "PROTONDB",
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 1,
    maxAttempts: 3,
    progress: 25,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    game: { id: "game-1", name: "Portal 2", externalIds: [{ externalId: "620" }] },
    ...overrides,
  };
}

describe("compatibility job runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, {
      enrichmentJob: { updateMany, findFirst, update },
      $transaction: transaction,
    });
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(job());
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      job({ ...data, status: data.status ?? "RUNNING", stage: data.stage ?? "MATCHING" }),
    );
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        compatibilitySnapshot: { upsert: snapshotUpsert },
        environmentCompatibility: { upsert: environmentUpsert },
      }),
    );
    snapshotUpsert.mockResolvedValue({});
    environmentUpsert.mockResolvedValue({});
    vi.mocked(lookupProtonDb).mockResolvedValue({
      appId: "620",
      confidence: "strong",
      tier: "gold",
      status: "READY",
      raw: { confidence: "strong", tier: "gold" },
    });
    vi.mocked(lookupAway).mockResolvedValue(null);
  });

  it("persists provider snapshots and environment rows before succeeding", async () => {
    const result = await runCompatJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED", progress: 100 } });
    expect(snapshotUpsert).toHaveBeenCalledTimes(2);
    expect(environmentUpsert).toHaveBeenCalledTimes(2);
    expect(snapshotUpsert.mock.calls.map(([call]) => call.where.gameId_provider.provider)).toEqual([
      "PROTONDB",
      "ARE_WE_ANTICHEAT_YET",
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("moves a transient provider error to RETRY_WAIT", async () => {
    vi.mocked(lookupProtonDb).mockResolvedValue({ category: "NETWORK", message: "offline" });

    const result = await runCompatJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "RETRY_WAIT" } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stage: "RETRYING", nextAttemptAt: expect.any(Date) }),
    }));
    expect(transaction).not.toHaveBeenCalled();
  });

  it("fails without provider calls when the game has no Steam identity", async () => {
    findFirst.mockResolvedValue(job({ game: { id: "game-1", name: "Manual ROM", externalIds: [] } }));

    const result = await runCompatJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "FAILED", lastErrorCode: "STEAM_ID_REQUIRED" } });
    expect(lookupProtonDb).not.toHaveBeenCalled();
  });
});
