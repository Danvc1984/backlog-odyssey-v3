import { describe, expect, it } from "vitest";
import {
  assertRawgJobTransition,
  canTransitionRawgJob,
  initialRawgJobState,
  isActiveRawgJobStatus,
  rawgJobProgress,
  RAWG_JOB_MAX_ATTEMPTS,
} from "./rawg-job";

describe("RAWG job state contract", () => {
  it("provides the durable defaults for a new job", () => {
    expect(initialRawgJobState()).toEqual({
      status: "QUEUED",
      stage: "MATCHING",
      attempt: 0,
      maxAttempts: RAWG_JOB_MAX_ATTEMPTS,
      progress: 0,
      nextAttemptAt: null,
    });
  });

  it("allows the expected job lifecycle transitions", () => {
    expect(canTransitionRawgJob("QUEUED", "RUNNING")).toBe(true);
    expect(canTransitionRawgJob("RUNNING", "RETRY_WAIT")).toBe(true);
    expect(canTransitionRawgJob("RUNNING", "AWAITING_MATCH")).toBe(true);
    expect(canTransitionRawgJob("RUNNING", "SUCCEEDED")).toBe(true);
    expect(canTransitionRawgJob("RETRY_WAIT", "RUNNING")).toBe(true);
    expect(canTransitionRawgJob("AWAITING_MATCH", "QUEUED")).toBe(true);
    expect(canTransitionRawgJob("FAILED", "QUEUED")).toBe(true);
  });

  it("rejects transitions that skip the runner lifecycle", () => {
    expect(canTransitionRawgJob("QUEUED", "SUCCEEDED")).toBe(false);
    expect(canTransitionRawgJob("SUCCEEDED", "RUNNING")).toBe(false);
    expect(() => assertRawgJobTransition("SUCCEEDED", "FAILED")).toThrow(
      "Invalid RAWG job transition: SUCCEEDED -> FAILED",
    );
  });

  it("maps stages to stable progress milestones", () => {
    expect(rawgJobProgress("MATCHING")).toBe(25);
    expect(rawgJobProgress("PERSISTING")).toBe(75);
    expect(rawgJobProgress("RETRYING")).toBe(25);
    expect(rawgJobProgress("COMPLETE")).toBe(100);
    expect(rawgJobProgress("FAILED")).toBe(0);
  });

  it("identifies states that still represent active or resumable work", () => {
    expect(isActiveRawgJobStatus("QUEUED")).toBe(true);
    expect(isActiveRawgJobStatus("RUNNING")).toBe(true);
    expect(isActiveRawgJobStatus("RETRY_WAIT")).toBe(true);
    expect(isActiveRawgJobStatus("AWAITING_MATCH")).toBe(true);
    expect(isActiveRawgJobStatus("SUCCEEDED")).toBe(false);
    expect(isActiveRawgJobStatus("FAILED")).toBe(false);
  });
});
