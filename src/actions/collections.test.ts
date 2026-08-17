import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  addGameToCollection,
  removeGameFromCollection,
} from "./collections";

describe("createCollection", () => {
  const mockFindFirst = vi.fn();
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).collection = {
      findFirst: mockFindFirst,
      create: mockCreate,
    };
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "coll-1", name: "Cozy games" });
  });

  it("creates a manual collection", async () => {
    const result = await createCollection({
      name: "Cozy games",
      color: "#8b5cf6",
      icon: "Heart",
    });

    expect(result.success).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Cozy games", mode: "insensitive" } },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { name: "Cozy games", color: "#8b5cf6", icon: "Heart" },
    });
  });

  it("rejects an empty name", async () => {
    const result = await createCollection({ name: "  " });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate name (exact match)", async () => {
    mockFindFirst.mockResolvedValue({ id: "coll-existing", name: "RPG" });

    const result = await createCollection({ name: "RPG" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("A collection with that name already exists");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    mockFindFirst.mockResolvedValue({ id: "coll-existing", name: "My Games" });

    const result = await createCollection({ name: "my games" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("A collection with that name already exists");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("treats omitted color/icon as null", async () => {
    await createCollection({ name: "RPG" });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { name: "RPG", color: null, icon: null },
    });
  });

  it("surfaces database errors", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection lost"));

    const result = await createCollection({ name: "RPG" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB connection lost");
  });
});

describe("updateCollection", () => {
  const mockFindFirst = vi.fn();
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).collection = {
      findFirst: mockFindFirst,
      update: mockUpdate,
    };
    mockFindFirst.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({ id: "coll-1", name: "Cozy games" });
  });

  it("updates name, color, and icon", async () => {
    const result = await updateCollection("coll-1", {
      name: "Cozy games 2",
      color: "#f43f5e",
      icon: "Star",
    });

    expect(result.success).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: "Cozy games 2", mode: "insensitive" },
        id: { not: "coll-1" },
      },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "coll-1" },
      data: { name: "Cozy games 2", color: "#f43f5e", icon: "Star" },
    });
  });

  it("rejects a case-insensitive duplicate name on another collection", async () => {
    mockFindFirst.mockResolvedValue({ id: "coll-other", name: "Indie" });

    const result = await updateCollection("coll-1", { name: "INDIE" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("A collection with that name already exists");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty collection id", async () => {
    const result = await updateCollection("", { name: "RPG" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const result = await updateCollection("coll-1", { name: "" });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows clearing color to null", async () => {
    await updateCollection("coll-1", { name: "RPG", color: null });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "coll-1" },
      data: { name: "RPG", color: null, icon: null },
    });
  });
});

describe("deleteCollection", () => {
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).collection = { delete: mockDelete };
    mockDelete.mockResolvedValue({ id: "coll-1" });
  });

  it("deletes the collection by id", async () => {
    const result = await deleteCollection("coll-1");

    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "coll-1" } });
  });

  it("rejects an empty collection id", async () => {
    const result = await deleteCollection(" ");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("addGameToCollection", () => {
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).collectionMembership = { create: mockCreate };
    mockCreate.mockResolvedValue({ collectionId: "coll-1", gameId: "game-1" });
  });

  it("creates a membership", async () => {
    const result = await addGameToCollection("coll-1", "game-1");

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { collectionId: "coll-1", gameId: "game-1" },
    });
  });

  it("treats a duplicate membership as success (P2002)", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });

    const result = await addGameToCollection("coll-1", "game-1");

    expect(result.success).toBe(true);
  });

  it("re-throws non-P2002 errors", async () => {
    mockCreate.mockRejectedValue(new Error("Foreign key violation"));

    const result = await addGameToCollection("coll-1", "game-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Foreign key violation");
  });
});

describe("removeGameFromCollection", () => {
  const mockDeleteMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).collectionMembership = { deleteMany: mockDeleteMany };
    mockDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("removes the membership", async () => {
    const result = await removeGameFromCollection("coll-1", "game-1");

    expect(result.success).toBe(true);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { collectionId: "coll-1", gameId: "game-1" },
    });
  });

  it("treats a missing membership as success (count 0)", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await removeGameFromCollection("coll-1", "game-1");

    expect(result.success).toBe(true);
  });
});