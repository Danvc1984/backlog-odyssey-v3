import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createDlc } from "./dlc";

describe("createDlc", () => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const tx = { game: { findUnique, create } };
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    prisma.$transaction = transaction;
    transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
    create.mockResolvedValue({ id: "dlc-1" });
  });

  it("creates a DLC attached to a base game", async () => {
    findUnique.mockResolvedValue({ type: "BASE_GAME" });

    const result = await createDlc({
      name: "The DLC",
      baseGameId: "base-1",
    });

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "DLC",
          baseGame: { connect: { id: "base-1" } },
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty("availability");
  });

  it("rejects a missing base game id", async () => {
    const result = await createDlc({
      name: "The DLC",
      baseGameId: "",
    });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a base game that does not exist", async () => {
    findUnique.mockResolvedValue(null);

    const result = await createDlc({
      name: "The DLC",
      baseGameId: "missing",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Base game not found",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects another DLC as the parent", async () => {
    findUnique.mockResolvedValue({ type: "DLC" });

    const result = await createDlc({
      name: "Nested DLC",
      baseGameId: "dlc-1",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "DLC parent must be a base game",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
