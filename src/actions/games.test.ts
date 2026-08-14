import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createGame } from "./games";

describe("createGame", () => {
  const tx = {
    game: {
      create: vi.fn(),
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
          availability: { create: { source: "STEAM", displayName: null } },
          libraryEntry: { create: {} },
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

  it("stores the optional display name on the availability row", async () => {
    await createGame({
      name: "Skyrim",
      availabilitySource: "OTHER_PLATFORM",
      displayName: "Skyrim (Epic)",
    });

    expect(tx.game.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availability: {
            create: { source: "OTHER_PLATFORM", displayName: "Skyrim (Epic)" },
          },
        }),
      }),
    );
  });
});
