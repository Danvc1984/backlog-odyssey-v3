import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/compat-job-runner", () => ({ runCompatJob: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { runCompatJob } from "@/lib/compat-job-runner";
import { refreshGameCompatibility } from "./compatibility";

describe("refreshGameCompatibility", () => {
  const gameFindUnique = vi.fn();
  const jobFindUnique = vi.fn();
  const jobCreate = vi.fn();
  const jobUpdate = vi.fn();
  const libraryFindUnique = vi.fn();
  const libraryUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(runCompatJob).mockResolvedValue({
      success: true,
      data: {
        id: "job-1",
        status: "SUCCEEDED",
        stage: "COMPLETE",
        attempt: 1,
        maxAttempts: 3,
        progress: 100,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      error: null,
    });
    Object.assign(prisma, {
      game: { findUnique: gameFindUnique },
      enrichmentJob: { findUnique: jobFindUnique, create: jobCreate, update: jobUpdate },
      libraryEntry: { findUnique: libraryFindUnique, update: libraryUpdate },
    });
    gameFindUnique.mockResolvedValue({ id: "game-1" });
    jobFindUnique.mockResolvedValue(null);
    jobCreate.mockResolvedValue({ id: "job-1" });
    libraryFindUnique.mockResolvedValue({ id: "library-1" });
    libraryUpdate.mockResolvedValue({});
  });

  it("creates a PROTONDB job and runs it", async () => {
    const result = await refreshGameCompatibility({ gameId: "game-1" });

    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED" } });
    expect(jobCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gameId: "game-1", provider: "PROTONDB", maxAttempts: 3 }),
    }));
    expect(runCompatJob).toHaveBeenCalledWith("job-1");
  });

  it("returns an active job without starting a second run", async () => {
    jobFindUnique.mockResolvedValue({ id: "job-1", status: "RUNNING" });

    const result = await refreshGameCompatibility({ gameId: "game-1" });

    expect(result).toMatchObject({ success: true, data: { id: "job-1", status: "RUNNING" } });
    expect(runCompatJob).not.toHaveBeenCalled();
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it("saves and clears a personal override", async () => {
    await expect(refreshGameCompatibility({ gameId: "game-1" })).resolves.toMatchObject({ success: true });

    const { setCompatOverride } = await import("./compatibility");
    const saved = await setCompatOverride({ gameId: "game-1", status: "REQUIRED", reason: "Anti-cheat blocks Bazzite" });
    expect(saved.success).toBe(true);
    expect(libraryUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { compatOverrideStatus: "REQUIRED", compatOverrideReason: "Anti-cheat blocks Bazzite" },
    });

    await setCompatOverride({ gameId: "game-1", status: null, reason: null });
    expect(libraryUpdate).toHaveBeenLastCalledWith({
      where: { gameId: "game-1" },
      data: { compatOverrideStatus: null, compatOverrideReason: null },
    });
  });
});
