import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import { persistIgdbIdentity } from "./igdb-enrichment";
import type { IgdbMatchResult } from "./igdb-types";

const findUnique = vi.fn();
const deleteMany = vi.fn();
const create = vi.fn();
const transaction = vi.fn();
const tx = { externalGameId: { findUnique, deleteMany, create } };

const matched: IgdbMatchResult = {
  outcome: "MATCHED",
  matchMethod: "INFERRED",
  game: { id: 42, name: "Portal 2", category: 0 },
};

describe("IGDB identity persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    findUnique.mockResolvedValue(null);
    deleteMany.mockResolvedValue({ count: 0 });
    create.mockResolvedValue({ id: "identity-1" });
  });

  it("returns a conflict without mutating either game", async () => {
    findUnique.mockResolvedValue({ gameId: "other-game", matchMethod: "INFERRED" });

    await expect(persistIgdbIdentity("game-1", matched)).resolves.toEqual({
      success: false,
      data: null,
      error: { code: "IGDB_ID_CONFLICT", message: "IGDB game identity is already attached to another catalog game" },
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("replaces only the existing IGDB identity rows", async () => {
    await expect(persistIgdbIdentity("game-1", matched)).resolves.toEqual({
      success: true,
      data: { gameId: "game-1", igdbId: 42 },
      error: null,
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { gameId: "game-1", namespace: "IGDB_GAME" } });
    expect(create).toHaveBeenCalledWith({
      data: {
        namespaceId: "42",
        namespace: "IGDB_GAME",
        externalId: "42",
        matchMethod: "INFERRED",
        gameId: "game-1",
      },
    });
  });

  it("preserves a manual match against automatic rematching", async () => {
    findUnique.mockResolvedValue({ gameId: "game-1", matchMethod: "MANUAL_IGDB_SEARCH" });

    await expect(persistIgdbIdentity("game-1", matched)).resolves.toMatchObject({ success: true });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("allows an explicit manual replacement", async () => {
    findUnique.mockResolvedValue({ gameId: "game-1", matchMethod: "MANUAL_IGDB_SEARCH" });
    const manual: IgdbMatchResult = {
      ...matched,
      matchMethod: "MANUAL_IGDB_SEARCH",
      game: { id: 99, name: "Different game", category: 0 },
    };

    await expect(persistIgdbIdentity("game-1", manual)).resolves.toMatchObject({
      success: true,
      data: { igdbId: 99 },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ externalId: "99" }) }));
  });

  it("rejects non-matched outcomes", async () => {
    await expect(persistIgdbIdentity("game-1", { outcome: "NOT_FOUND" })).resolves.toMatchObject({
      success: false,
      error: { code: "NOT_MATCHED" },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
