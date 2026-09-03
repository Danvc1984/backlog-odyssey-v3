import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isRetryableJobProviderError,
  jobClaimWhere,
  jobRetryDelay,
} from "./enrichment-job-shared";

describe("enrichment job shared helpers", () => {
  it("uses exponential retry delays with a stable first boundary", () => {
    expect(jobRetryDelay(0)).toBe(1000);
    expect(jobRetryDelay(1)).toBe(1000);
    expect(jobRetryDelay(2)).toBe(2000);
    expect(jobRetryDelay(3)).toBe(4000);
  });

  it.each([
    [{ category: "NETWORK" }, true],
    [{ category: "HTTP", status: 429 }, true],
    [{ category: "HTTP", status: 500 }, true],
    [{ category: "HTTP", status: 404 }, false],
    [{ category: "MALFORMED_RESPONSE" }, false],
  ] as const)("classifies %o as retryable=%s", (error, expected) => {
    expect(isRetryableJobProviderError(error)).toBe(expected);
  });

  it("builds the guarded claim filter for queued and due retries", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");

    expect(jobClaimWhere({ jobId: "job-1", provider: "RAWG", maxAttempts: 3, now })).toEqual({
      id: "job-1",
      provider: "RAWG",
      game: {
        OR: [
          { libraryEntry: { is: null } },
          { libraryEntry: { is: { hidden: false } } },
        ],
      },
      attempt: { lt: 3 },
      OR: [
        { status: "QUEUED" },
        { status: "RETRY_WAIT", nextAttemptAt: { lte: now } },
      ],
    });
  });
});
