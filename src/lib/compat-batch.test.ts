import { describe, expect, it } from "vitest";
import {
  compatBatchProgress,
  compatBatchStatus,
  compatBatchSummary,
  emptyCompatBatchCounts,
  summarizeCompatBatchJobs,
} from "./compat-batch";

describe("compatibility batch summaries", () => {
  it("counts every compatibility job state", () => {
    expect(summarizeCompatBatchJobs([
      { status: "QUEUED" },
      { status: "RUNNING" },
      { status: "RETRY_WAIT" },
      { status: "SUCCEEDED" },
      { status: "FAILED" },
    ])).toEqual({
      total: 5,
      queued: 1,
      running: 1,
      retryWaiting: 1,
      succeeded: 1,
      failed: 1,
    });
  });

  it("classifies active, empty, partial, and successful batches", () => {
    expect(compatBatchStatus({
      ...emptyCompatBatchCounts(),
      total: 1,
      queued: 1,
    })).toBe("RUNNING");
    expect(compatBatchStatus(emptyCompatBatchCounts())).toBe("FAILED");
    expect(compatBatchStatus({
      ...emptyCompatBatchCounts(),
      total: 1,
      failed: 1,
    })).toBe("PARTIAL");
    expect(compatBatchStatus({
      ...emptyCompatBatchCounts(),
      total: 1,
      succeeded: 1,
    })).toBe("SUCCESS");
  });

  it("rounds terminal progress and keeps an empty batch at zero", () => {
    expect(compatBatchProgress(emptyCompatBatchCounts())).toBe(0);
    expect(compatBatchProgress({
      ...emptyCompatBatchCounts(),
      total: 3,
      succeeded: 1,
    })).toBe(33);
    expect(compatBatchProgress({
      ...emptyCompatBatchCounts(),
      total: 3,
      succeeded: 2,
    })).toBe(67);
  });

  it("returns a terminal summary for completed jobs", () => {
    expect(compatBatchSummary([
      { status: "SUCCEEDED" },
      { status: "FAILED" },
    ])).toEqual({
      counts: {
        total: 2,
        queued: 0,
        running: 0,
        retryWaiting: 0,
        succeeded: 1,
        failed: 1,
      },
      status: "PARTIAL",
      progress: 100,
      isTerminal: true,
    });
  });
});
