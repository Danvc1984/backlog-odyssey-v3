import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createGame } from "./games";

describe("createGame", () => {
  const mockAltFind = vi.fn();
  const tx = {
    game: {
      create: vi.fn(),
    },
    enrichmentJob: {
      create: vi.fn(),
    },
    alternativeSource: {
      findUnique: mockAltFind,
    },
  };
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    prisma.$transaction = transaction;
    transaction.mockImplementation(async (fn: (client: unknown) => unknown) =>
      fn(tx),
    );
    tx.game.create.mockResolvedValue({ id: "game-1" });
    tx.enrichmentJob.create.mockResolvedValue({});
    mockAltFind.mockResolvedValue(null);

    // The action imports the real auth-guard module once; reset it per test.
  });

  it("creates a Game, GameAvailability, and LibraryEntry in one transaction", async () => {
    const result = await createGame({
      name: "Hollow Knight",
      availabilitySource: "STEAM",
    });

    expect(result.success).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BASE_GAME",
          origin: "MANUAL",
          name: "Hollow Knight",
          availability: {
            create: { source: "STEAM", alternativeSourceId: null },
          },
          libraryEntry: { create: {} },
        }),
      }),
    );
  });

  it("leaves Play priority unset by default", async () => {
    await createGame({ name: "Unset game", availabilitySource: "STEAM" });
    expect(tx.game.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ libraryEntry: { create: {} } }),
    }));
  });

  it("persists the requested Play priority and queues a selected IGDB match", async () => {
    await createGame({
      name: "Portal 2",
      availabilitySource: "STEAM",
      interest: 5,
      selectedIgdbId: 42,
    });

    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ libraryEntry: { create: { interest: 5 } } }),
      }),
    );
    expect(tx.enrichmentJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gameId: "game-1",
        provider: "IGDB",
        status: "QUEUED",
        stage: "MATCHING",
        selectedIgdbId: 42,
        candidatePayload: expect.anything(),
      }),
    });
  });

  it("does not create an IGDB job when no match is selected", async () => {
    await createGame({ name: "Randomizer", availabilitySource: "STEAM" });

    expect(tx.enrichmentJob.create).not.toHaveBeenCalled();
  });

  it("rejects invalid interest and IGDB IDs before the transaction", async () => {
    await expect(createGame({ name: "Test", availabilitySource: "STEAM", interest: 0 })).resolves.toMatchObject({ success: false, error: "Invalid input" });
    await expect(createGame({ name: "Test", availabilitySource: "STEAM", selectedIgdbId: 0 })).resolves.toMatchObject({ success: false, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("leaves the alternative source id null on a ROM row", async () => {
    await createGame({
      name: "Randomizer",
      availabilitySource: "ROM",
    });

    expect(mockAltFind).not.toHaveBeenCalled();
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: {
            create: { source: "ROM", alternativeSourceId: null },
          },
        }),
      }),
    );
  });

  it("uses the selected alternative source id", async () => {
    mockAltFind.mockResolvedValue({ id: "source-1", archivedAt: null });

    await createGame({
      name: "Control",
      availabilitySource: "OTHER_PLATFORM",
      alternativeSourceId: "source-1",
    });

    expect(mockAltFind).toHaveBeenCalledWith({
      where: { id: "source-1" },
      select: { id: true, archivedAt: true },
    });
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: expect.objectContaining({
            create: expect.objectContaining({ alternativeSourceId: "source-1" }),
          }),
        }),
      }),
    );
  });

  it("requires a saved source for OTHER_PLATFORM rows", async () => {
    const result = await createGame({
      name: "Skyrim",
      availabilitySource: "OTHER_PLATFORM",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Alternative source is required",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown or archived alternative source", async () => {
    mockAltFind.mockResolvedValueOnce(null);
    const missing = await createGame({
      name: "Portal",
      availabilitySource: "OTHER_PLATFORM",
      alternativeSourceId: "missing",
    });
    mockAltFind.mockResolvedValueOnce({ id: "source-1", archivedAt: new Date() });
    const archived = await createGame({
      name: "Portal",
      availabilitySource: "OTHER_PLATFORM",
      alternativeSourceId: "source-1",
    });

    expect(missing.error).toBe("Alternative source not found");
    expect(archived.error).toBe("This source is archived and cannot be selected");
    expect(tx.game.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name", async () => {
    const result = await createGame({
      name: "",
      availabilitySource: "ROM",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown availability source", async () => {
    const result = await createGame({
      name: "Test",
      availabilitySource: "EPIC" as never,
    });

    expect(result.success).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });
});
