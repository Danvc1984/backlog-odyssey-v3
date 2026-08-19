import { describe, expect, it } from "vitest";
import {
  persistedRawgBatchSummary,
  rawgBatchSummary,
} from "./rawg-batch";

describe("RAWG batch summaries", () => {
  it("classifies every RAWG job state in the aggregate counts", () => {
    const summary = rawgBatchSummary([
      { status: "QUEUED" },
      { status: "RUNNING" },
      { status: "RETRY_WAIT" },
      { status: "AWAITING_MATCH" },
      { status: "SUCCEEDED" },
      { status: "FAILED" },
    ]);

    expect(summary).toEqual({
      counts: {
        total: 6,
        queued: 1,
        running: 1,
        retryWaiting: 1,
        awaitingMatch: 1,
        succeeded: 1,
        failed: 1,
      },
      status: "RUNNING",
      progress: 50,
      isTerminal: false,
    });
  });

  it("makes an unresolved match review a partial terminal outcome", () => {
    expect(rawgBatchSummary([
      { status: "SUCCEEDED" },
      { status: "AWAITING_MATCH" },
    ])).toMatchObject({
      status: "PARTIAL",
      progress: 100,
      isTerminal: true,
    });
  });

  it("keeps a completed batch summary when individual jobs change later", () => {
    const completedCounts = {
      total: 2,
      queued: 0,
      running: 0,
      retryWaiting: 0,
      awaitingMatch: 0,
      succeeded: 2,
      failed: 0,
    };

    expect(persistedRawgBatchSummary("SUCCESS", completedCounts)).toEqual({
      counts: completedCounts,
      status: "SUCCESS",
      progress: 100,
      isTerminal: true,
    });
    expect(rawgBatchSummary([{ status: "QUEUED" }, { status: "FAILED" }]))
      .not.toMatchObject({ counts: completedCounts });
  });

  it("rejects malformed or active persisted summaries", () => {
    expect(persistedRawgBatchSummary("RUNNING", { total: 1 })).toBeNull();
    expect(persistedRawgBatchSummary("SUCCESS", { total: -1 })).toBeNull();
  });
});
