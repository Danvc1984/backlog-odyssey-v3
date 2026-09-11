import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/enrichment-batch-start", () => ({ startProviderEnrichmentBatch: vi.fn() }));
vi.mock("@/lib/igdb-job", () => ({ initialIgdbJobState: vi.fn(() => ({})), isActiveIgdbJobStatus: (status: string) => ["QUEUED", "RUNNING", "RETRY_WAIT"].includes(status) }));
vi.mock("@/lib/igdb-batch-runner", () => ({ igdbBatchSummary: vi.fn() }));

import { getIgdbBatchEligibility } from "@/lib/igdb-batch-eligibility";

describe("IGDB batch eligibility", () => {
  it("queues games missing metadata or playtime evidence", () => {
    const result = getIgdbBatchEligibility([
      { id: "complete", metadataSnapshots: [{ id: "snapshot" }], playtimeEvidence: { id: "evidence" }, enrichmentJobs: [] },
      { id: "missing-evidence", metadataSnapshots: [{ id: "snapshot" }], playtimeEvidence: null, enrichmentJobs: [] },
      { id: "missing-metadata", metadataSnapshots: [], playtimeEvidence: null, enrichmentJobs: [] },
      { id: "active", metadataSnapshots: [], playtimeEvidence: null, enrichmentJobs: [{ status: "RUNNING" }] },
    ]);

    expect(result.eligibleGames.map((game) => game.id)).toEqual(["missing-evidence", "missing-metadata"]);
    expect(result.counts).toEqual({ eligible: 2, queued: 2, skippedFullyEnriched: 1, skippedActiveWork: 1 });
  });
});
