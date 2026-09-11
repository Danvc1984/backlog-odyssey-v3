import { describe, expect, it } from "vitest";
import {
  batchSummary,
  persistedBatchSummary,
} from "./enrichment-batch-summary";

describe("provider-agnostic batch summaries", () => {
  it("classifies every enrichment job state", () => {
    expect(batchSummary([
      { status: "QUEUED" },
      { status: "RUNNING" },
      { status: "RETRY_WAIT" },
      { status: "AWAITING_MATCH" },
      { status: "SUCCEEDED" },
      { status: "FAILED" },
    ])).toEqual({
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

  it("preserves terminal persisted summaries and rejects active or malformed data", () => {
    const counts = {
      total: 2,
      queued: 0,
      running: 0,
      retryWaiting: 0,
      awaitingMatch: 0,
      succeeded: 2,
      failed: 0,
    };

    expect(persistedBatchSummary("SUCCESS", counts)).toEqual({
      counts,
      status: "SUCCESS",
      progress: 100,
      isTerminal: true,
    });
    expect(persistedBatchSummary("RUNNING", { total: 1 })).toBeNull();
    expect(persistedBatchSummary("SUCCESS", { total: -1 })).toBeNull();
  });
});
