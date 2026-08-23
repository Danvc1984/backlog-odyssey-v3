import { describe, expect, it } from "vitest";

import { candidatePageFromPayload, toRawgEnrichmentJobView } from "./rawg-job-view";
import type { EnrichmentJobStage, EnrichmentJobStatus } from "@/generated/prisma/client";

const candidate = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  released: "2011-04-18",
  backgroundImage: "https://media.rawg.io/media/games/x.jpg",
};

function jobWithPayload(candidatePayload: unknown) {
  return {
    id: "job-1",
    provider: "RAWG",
    status: "AWAITING_MATCH" as EnrichmentJobStatus,
    stage: "MATCHING" as EnrichmentJobStage,
    attempt: 1,
    maxAttempts: 3,
    progress: 50,
    nextAttemptAt: null,
    candidatePayload,
    selectedRawgId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

describe("candidatePageFromPayload", () => {
  it("parses a paged payload as-is", () => {
    expect(
      candidatePageFromPayload({ candidates: [candidate], nextPage: 7 }),
    ).toEqual({ candidates: [candidate], nextPage: 7 });
  });

  it("fabricates nextPage 2 for a legacy non-empty plain array", () => {
    expect(candidatePageFromPayload([candidate])).toEqual({
      candidates: [candidate],
      nextPage: 2,
    });
  });

  it("returns no next page for a legacy empty array", () => {
    expect(candidatePageFromPayload([])).toEqual({ candidates: [], nextPage: null });
  });

  it("collapses garbage payloads to empty candidates", () => {
    expect(candidatePageFromPayload({ candidates: "oops" })).toEqual({
      candidates: [],
      nextPage: null,
    });
    expect(candidatePageFromPayload(null)).toEqual({ candidates: [], nextPage: null });
  });
});

describe("toRawgEnrichmentJobView hasMoreCandidates", () => {
  it("is true only when a next page exists", () => {
    expect(toRawgEnrichmentJobView(jobWithPayload([candidate])).hasMoreCandidates).toBe(true);
    expect(toRawgEnrichmentJobView(jobWithPayload([])).hasMoreCandidates).toBe(false);
    expect(
      toRawgEnrichmentJobView(jobWithPayload({ candidates: [candidate], nextPage: null }))
        .hasMoreCandidates,
    ).toBe(false);
  });
});
