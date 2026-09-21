import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  createPersonalTag,
  deletePersonalTag,
  mergePersonalTag,
  renamePersonalTag,
} from "./personal-tags";

describe("personal tag actions", () => {
  const rootUpsert = vi.fn();
  const rootFindUnique = vi.fn();
  const txFindUnique = vi.fn();
  const txUpdate = vi.fn();
  const txDelete = vi.fn();
  const gameFindMany = vi.fn();
  const gameCreateMany = vi.fn();
  const gameCount = vi.fn();
  const tuneFindUnique = vi.fn();
  const tuneUpdate = vi.fn();
  const presetFindMany = vi.fn();
  const presetUpdate = vi.fn();
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({
    personalTag: { findUnique: txFindUnique, update: txUpdate, delete: txDelete },
    gameTag: { findMany: gameFindMany, createMany: gameCreateMany, count: gameCount },
    recommendationTuneState: { findUnique: tuneFindUnique, update: tuneUpdate },
    recommendationPreset: { findMany: presetFindMany, update: presetUpdate },
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { email: "owner@example.com" } });
    Object.assign(prisma, {
      personalTag: { upsert: rootUpsert, findUnique: rootFindUnique },
      $transaction: transaction,
    });
    rootUpsert.mockResolvedValue({ id: "tag-1", name: "RPG", normalizedName: "rpg" });
    rootFindUnique.mockResolvedValue({ id: "tag-1", name: "RPG", normalizedName: "rpg" });
    txFindUnique.mockImplementation(async ({ where }: { where: { id?: string; normalizedName?: string } }) =>
      where.id === "tag-1" || where.normalizedName === "rpg"
        ? { id: "tag-1", name: "RPG", normalizedName: "rpg", _count: { games: 2 } }
        : null,
    );
    txUpdate.mockResolvedValue({ id: "tag-1", name: "Favorites", normalizedName: "favorites" });
    txDelete.mockResolvedValue({});
    gameFindMany.mockResolvedValue([]);
    gameCreateMany.mockResolvedValue({ count: 0 });
    gameCount.mockResolvedValue(3);
    tuneFindUnique.mockResolvedValue({ id: 1, playTune: { personalTags: ["RPG", "Co-op"] }, buyTune: null });
    tuneUpdate.mockResolvedValue({});
    presetFindMany.mockResolvedValue([{ id: "preset-1", tune: { personalTags: ["rpg", "Co-op"] } }]);
    presetUpdate.mockResolvedValue({});
  });

  it("trims names and reuses a normalized tag without changing its capitalization", async () => {
    await expect(createPersonalTag({ name: "  RPG  " })).resolves.toMatchObject({ success: true });
    expect(rootUpsert).toHaveBeenCalledWith({
      where: { normalizedName: "rpg" },
      create: { name: "RPG", normalizedName: "rpg" },
      update: {},
    });
  });

  it("renames while preserving the tag id and memberships", async () => {
    rootFindUnique
      .mockResolvedValueOnce({ id: "tag-1", name: "RPG", normalizedName: "rpg" })
      .mockResolvedValueOnce(null);

    await expect(renamePersonalTag({ tagId: "tag-1", name: "  Favorites " })).resolves.toMatchObject({ success: true });
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "tag-1" },
      data: { name: "Favorites", normalizedName: "favorites" },
    });
    expect(gameCreateMany).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before a rename can merge", async () => {
    rootFindUnique
      .mockResolvedValueOnce({ id: "tag-1", name: "RPG", normalizedName: "rpg" })
      .mockResolvedValueOnce({ id: "tag-2" });

    await expect(renamePersonalTag({ tagId: "tag-1", name: "favorites" })).resolves.toEqual({
      success: false,
      data: null,
      error: "A tag with that name already exists; confirm merge to continue",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("performs an explicitly confirmed rename merge into the existing target", async () => {
    rootFindUnique
      .mockResolvedValueOnce({ id: "tag-1", name: "RPG", normalizedName: "rpg" })
      .mockResolvedValueOnce({ id: "tag-2" });
    txFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "tag-1"
        ? { id: "tag-1", name: "RPG", normalizedName: "rpg", _count: { games: 1 } }
        : { id: "tag-2", name: "Favorites", normalizedName: "favorites" },
    );

    await expect(renamePersonalTag({ tagId: "tag-1", name: "favorites", confirmMerge: true })).resolves.toMatchObject({
      success: true,
      data: { id: "tag-2", mergedTagId: "tag-1", count: 3 },
    });
    expect(txDelete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });

  it("unions memberships and repairs active tune and preset references during merge", async () => {
    txFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "tag-1"
        ? { id: "tag-1", name: "RPG", normalizedName: "rpg", _count: { games: 2 } }
        : { id: "tag-2", name: "Favorites", normalizedName: "favorites" },
    );
    gameFindMany.mockResolvedValue([{ gameId: "game-1" }, { gameId: "game-2" }]);

    await expect(mergePersonalTag({ tagId: "tag-1", targetTagId: "tag-2" })).resolves.toMatchObject({
      success: true,
      data: { id: "tag-2", mergedTagId: "tag-1" },
    });
    expect(gameCreateMany).toHaveBeenCalledWith({
      data: [{ gameId: "game-1", tagId: "tag-2" }, { gameId: "game-2", tagId: "tag-2" }],
      skipDuplicates: true,
    });
    expect(tuneUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        playTune: { personalTags: ["Favorites", "Co-op"] },
      }),
    }));
    expect(presetUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { tune: { personalTags: ["Favorites", "Co-op"] } },
    }));
    expect(txDelete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });

  it("deletes memberships and active references without changing historical runs", async () => {
    await expect(deletePersonalTag({ tagId: "tag-1" })).resolves.toMatchObject({
      success: true,
      data: { id: "tag-1", removedGames: 2 },
    });
    expect(tuneUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ playTune: { personalTags: ["Co-op"] } }),
    }));
    expect(txDelete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });

  it("returns a friendly error when a transaction fails unexpectedly", async () => {
    transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(deletePersonalTag({ tagId: "tag-1" })).resolves.toMatchObject({
      success: false,
      error: "Failed to delete tag",
    });
  });

  it("authenticates before validating or looking up a tag", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("denied"));
    await expect(deletePersonalTag({ tagId: "tag-1" })).resolves.toMatchObject({
      success: false,
      error: "Failed to delete tag",
    });
    expect(requireUser).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
  });
});
