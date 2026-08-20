import { describe, expect, it } from "vitest";
import { activeRawgBatchPollId } from "./rawg-batch-polling";

describe("activeRawgBatchPollId", () => {
  it("keeps the polling key stable when a running batch progress changes", () => {
    const initial = activeRawgBatchPollId({ id: "batch-1", status: "RUNNING" });
    const updated = activeRawgBatchPollId({ id: "batch-1", status: "RUNNING" });

    expect(updated).toBe(initial);
  });

  it("stops polling when the batch is terminal", () => {
    expect(activeRawgBatchPollId({ id: "batch-1", status: "SUCCESS" })).toBeNull();
  });
});
