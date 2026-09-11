import { describe, expect, it } from "vitest";
import {
  assertIgdbJobTransition,
  canTransitionIgdbJob,
  IGDB_JOB_MAX_ATTEMPTS,
  igdbJobProgress,
  initialIgdbJobState,
  isActiveIgdbJobStatus,
} from "./igdb-job";

describe("IGDB job state contract", () => {
  it("provides the durable defaults for a new job", () => {
    expect(initialIgdbJobState()).toEqual({
      status: "QUEUED",
      stage: "MATCHING",
      attempt: 0,
      maxAttempts: IGDB_JOB_MAX_ATTEMPTS,
      progress: 0,
      nextAttemptAt: null,
    });
  });

  it("allows the expected job lifecycle transitions", () => {
    expect(canTransitionIgdbJob("QUEUED", "RUNNING")).toBe(true);
    expect(canTransitionIgdbJob("RUNNING", "RETRY_WAIT")).toBe(true);
    expect(canTransitionIgdbJob("RUNNING", "AWAITING_MATCH")).toBe(true);
    expect(canTransitionIgdbJob("RUNNING", "SUCCEEDED")).toBe(true);
    expect(canTransitionIgdbJob("RETRY_WAIT", "RUNNING")).toBe(true);
    expect(canTransitionIgdbJob("AWAITING_MATCH", "QUEUED")).toBe(true);
    expect(canTransitionIgdbJob("FAILED", "QUEUED")).toBe(true);
  });

  it("rejects transitions that skip the runner lifecycle", () => {
    expect(canTransitionIgdbJob("QUEUED", "SUCCEEDED")).toBe(false);
    expect(canTransitionIgdbJob("SUCCEEDED", "RUNNING")).toBe(false);
    expect(() => assertIgdbJobTransition("SUCCEEDED", "FAILED")).toThrow(
      "Invalid IGDB job transition: SUCCEEDED -> FAILED",
    );
  });

  it("maps stages to stable progress milestones", () => {
    expect(igdbJobProgress("MATCHING")).toBe(25);
    expect(igdbJobProgress("PERSISTING")).toBe(75);
    expect(igdbJobProgress("RETRYING")).toBe(25);
    expect(igdbJobProgress("COMPLETE")).toBe(100);
    expect(igdbJobProgress("FAILED")).toBe(0);
  });

  it("identifies states that still represent active or resumable work", () => {
    expect(isActiveIgdbJobStatus("QUEUED")).toBe(true);
    expect(isActiveIgdbJobStatus("RUNNING")).toBe(true);
    expect(isActiveIgdbJobStatus("RETRY_WAIT")).toBe(true);
    expect(isActiveIgdbJobStatus("AWAITING_MATCH")).toBe(true);
    expect(isActiveIgdbJobStatus("SUCCEEDED")).toBe(false);
    expect(isActiveIgdbJobStatus("FAILED")).toBe(false);
  });
});
