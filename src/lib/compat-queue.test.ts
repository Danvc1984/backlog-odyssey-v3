import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/compat-job-runner", () => ({ runCompatJob: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { runCompatJob } from "@/lib/compat-job-runner";
import { isCompatEligible, queueCompatibilityForGame } from "./compat-queue";

describe("compatibility queue", () => {
  const gameFindUnique = vi.fn();
  const jobFindUnique = vi.fn();
  const jobUpsert = vi.fn();

  const eligibleGame = {
    libraryEntry: { id: "library-1" },
    externalIds: [{ namespace: "STEAM_APP" }],
    availability: [{ source: "STEAM" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, {
      game: { findUnique: gameFindUnique },
      enrichmentJob: { findUnique: jobFindUnique, upsert: jobUpsert },
    });
    gameFindUnique.mockResolvedValue(eligibleGame);
    jobFindUnique.mockResolvedValue(null);
    jobUpsert.mockResolvedValue({ id: "job-1" });
    vi.mocked(runCompatJob).mockResolvedValue(null);
  });

  it("requires a Steam identity and library entry, and excludes ROM-only games", () => {
    expect(isCompatEligible({ ...eligibleGame, externalIds: [] })).toBe(false);
    expect(isCompatEligible({ ...eligibleGame, libraryEntry: null })).toBe(false);
    expect(isCompatEligible({
      ...eligibleGame,
      availability: [{ source: "ROM" }],
    })).toBe(false);
    expect(isCompatEligible(eligibleGame)).toBe(true);
  });

  it("skips an ineligible game before looking for a job", async () => {
    gameFindUnique.mockResolvedValue({ ...eligibleGame, externalIds: [] });

    await expect(queueCompatibilityForGame("game-1")).resolves.toBeNull();

    expect(jobFindUnique).not.toHaveBeenCalled();
    expect(jobUpsert).not.toHaveBeenCalled();
    expect(runCompatJob).not.toHaveBeenCalled();
  });

  it("skips a game with active compatibility work", async () => {
    jobFindUnique.mockResolvedValue({ id: "job-1", status: "RUNNING" });

    await expect(queueCompatibilityForGame("game-1")).resolves.toBeNull();

    expect(jobUpsert).not.toHaveBeenCalled();
    expect(runCompatJob).not.toHaveBeenCalled();
  });

  it("upserts the standard queued job and runs it", async () => {
    await queueCompatibilityForGame("game-1");

    expect(jobUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_provider: { gameId: "game-1", provider: "PROTONDB" } },
      create: expect.objectContaining({
        gameId: "game-1",
        provider: "PROTONDB",
        status: "QUEUED",
        stage: "MATCHING",
        maxAttempts: 3,
        progress: 0,
      }),
      update: expect.objectContaining({ status: "QUEUED", stage: "MATCHING" }),
    }));
    expect(runCompatJob).toHaveBeenCalledWith("job-1");
  });
});
