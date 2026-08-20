interface RawgBatchPollState {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
}

export function activeRawgBatchPollId(batch: RawgBatchPollState | null): string | null {
  return batch?.status === "RUNNING" ? batch.id : null;
}
