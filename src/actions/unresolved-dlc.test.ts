import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  discardUnresolvedDlc,
  getUnresolvedSteamDlcs,
  linkUnresolvedDlc,
  restoreUnresolvedDlc,
  resolveUnresolvedDlcWithNewBase,
} from "./unresolved-dlc";

describe("unresolved DLC actions", () => {
  const findMany = vi.fn();
  const findUniqueQueue = vi.fn();
  const updateQueue = vi.fn();
  const deleteQueue = vi.fn();
  const findBase = vi.fn();
  const createGame = vi.fn();
  const transaction = vi.fn();
  const queue = {
    findMany,
    findUnique: findUniqueQueue,
    update: updateQueue,
    delete: deleteQueue,
  };
  const tx = { unresolvedSteamDlc: queue, game: { findUnique: findBase, create: createGame } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    (prisma as unknown as Record<string, unknown>).unresolvedSteamDlc = queue;
    (prisma as unknown as Record<string, unknown>).$transaction = transaction;
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    findUniqueQueue.mockResolvedValue({
      id: "queue-1",
      name: "Expansion",
      steamAppId: "200",
      steamBaseAppId: "100",
    });
    findBase.mockResolvedValue({ id: "base-1", type: "BASE_GAME" });
    createGame.mockResolvedValue({ id: "dlc-1", name: "Expansion", type: "DLC", baseGameId: "base-1" });
    updateQueue.mockResolvedValue({ id: "queue-1", status: "DISCARDED" });
    deleteQueue.mockResolvedValue({});
  });

  it("lists unresolved DLC records", async () => {
    findMany.mockResolvedValue([{ id: "queue-1", status: "PENDING" }]);

    await expect(getUnresolvedSteamDlcs()).resolves.toEqual({
      success: true,
      data: [{ id: "queue-1", status: "PENDING" }],
      error: null,
    });
  });

  it("links a queued DLC to an existing base game and removes the queue item", async () => {
    const result = await linkUnresolvedDlc({
      unresolvedId: "queue-1",
      targetBaseGameId: "base-1",
    });

    expect(result.success).toBe(true);
    expect(createGame).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "DLC", baseGameId: "base-1" }),
    }));
    expect(deleteQueue).toHaveBeenCalledWith({ where: { id: "queue-1" } });
  });

  it("creates a base game and DLC atomically", async () => {
    createGame
      .mockResolvedValueOnce({ id: "base-1", name: "Base game" })
      .mockResolvedValueOnce({ id: "dlc-1", name: "Expansion", type: "DLC", baseGameId: "base-1" });

    const result = await resolveUnresolvedDlcWithNewBase({
      unresolvedId: "queue-1",
      baseGameName: "Base game",
    });

    expect(result.success).toBe(true);
    expect(createGame).toHaveBeenCalledTimes(2);
    expect(deleteQueue).toHaveBeenCalledWith({ where: { id: "queue-1" } });
  });

  it("discards and restores a queued DLC", async () => {
    await discardUnresolvedDlc({ unresolvedId: "queue-1" });
    expect(updateQueue).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "queue-1" },
      data: expect.objectContaining({ status: "DISCARDED", discardedAt: expect.any(Date) }),
    }));

    await restoreUnresolvedDlc({ unresolvedId: "queue-1" });
    expect(updateQueue).toHaveBeenLastCalledWith({
      where: { id: "queue-1" },
      data: { status: "PENDING", discardedAt: null },
    });
  });

  it("rejects invalid input before database access", async () => {
    const result = await linkUnresolvedDlc({ unresolvedId: "", targetBaseGameId: "base-1" });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns a typed error for a missing queue record", async () => {
    findUniqueQueue.mockResolvedValue(null);

    await expect(discardUnresolvedDlc({ unresolvedId: "missing" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Unresolved DLC not found",
    });
  });
});
