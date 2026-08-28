import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createGame } from "./games";

describe("createGame", () => {
  const mockAltFind = vi.fn();
  const mockAltCreate = vi.fn();
  const tx = {
    game: {
      create: vi.fn(),
    },
    alternativeSource: {
      findUnique: mockAltFind,
      create: mockAltCreate,
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
    tx.game.create.mockResolvedValue({});
    mockAltFind.mockResolvedValue(null);
    mockAltCreate.mockResolvedValue({ id: "unsource-1" });

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
            create: { source: "STEAM", displayName: null, alternativeSourceId: null },
          },
          libraryEntry: { create: {} },
        }),
      }),
    );
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
            create: { source: "ROM", displayName: null, alternativeSourceId: null },
          },
        }),
      }),
    );
  });

  it("builds or reuses the unspecified source for OTHER_PLATFORM rows", async () => {
    await createGame({
      name: "Skyrim",
      availabilitySource: "OTHER_PLATFORM",
      displayName: "Skyrim (GOG)",
    });

    expect(mockAltFind).toHaveBeenCalledWith({
      where: { normalizedName: "unspecified other source" },
    });
    expect(mockAltCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Unspecified other source" }),
      }),
    );
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: {
            create: {
              source: "OTHER_PLATFORM",
              displayName: "Skyrim (GOG)",
              alternativeSourceId: "unsource-1",
            },
          },
        }),
      }),
    );
  });

  it("reuses an existing unspecified record instead of creating one", async () => {
    mockAltFind.mockResolvedValue({ id: "existing-unsource" });

    await createGame({
      name: "Portal",
      availabilitySource: "OTHER_PLATFORM",
    });

    expect(mockAltCreate).not.toHaveBeenCalled();
    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: expect.objectContaining({
            create: expect.objectContaining({ alternativeSourceId: "existing-unsource" }),
          }),
        }),
      }),
    );
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
