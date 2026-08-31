import { describe, expect, it } from "vitest";
import { aggregateTodayOperations } from "./today-operations";

describe("aggregateTodayOperations", () => {
  it("aggregates job statuses, provider timestamps, and running rows", () => {
    const fetchedAt = new Date("2026-08-30T12:00:00.000Z");
    const startedAt = new Date("2026-08-31T11:00:00.000Z");
    expect(aggregateTodayOperations({
      steamLastSyncAt: fetchedAt,
      rawgLastFetchedAt: null,
      itadLastFinishedAt: fetchedAt,
      compatibilityLastFetchedAt: fetchedAt,
      jobStatuses: ["QUEUED", "RUNNING", "RETRY_WAIT", "FAILED", "SUCCEEDED", "AWAITING_MATCH"],
      runningRuns: [{ kind: "Sync STEAM", startedAt }],
    })).toEqual({
      providers: [
        { name: "Steam", lastSuccessAt: fetchedAt.toISOString() },
        { name: "RAWG", lastSuccessAt: null },
        { name: "ITAD", lastSuccessAt: fetchedAt.toISOString() },
        { name: "Compatibility", lastSuccessAt: fetchedAt.toISOString() },
      ],
      jobs: { queued: 1, running: 1, retryWait: 1, failed: 1 },
      runningRuns: [{ kind: "Sync STEAM", startedAt: startedAt.toISOString() }],
    });
  });

  it("returns zero counts and absent timestamps when records are missing", () => {
    expect(aggregateTodayOperations({
      steamLastSyncAt: null,
      rawgLastFetchedAt: null,
      itadLastFinishedAt: null,
      compatibilityLastFetchedAt: null,
      jobStatuses: [],
      runningRuns: [],
    })).toEqual({
      providers: [
        { name: "Steam", lastSuccessAt: null },
        { name: "RAWG", lastSuccessAt: null },
        { name: "ITAD", lastSuccessAt: null },
        { name: "Compatibility", lastSuccessAt: null },
      ],
      jobs: { queued: 0, running: 0, retryWait: 0, failed: 0 },
      runningRuns: [],
    });
  });
});
