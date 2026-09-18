import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { deletePersonalTag } from "./personal-tags";

describe("deletePersonalTag", () => {
  const findUnique = vi.fn();
  const deleteTag = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as { personalTag: { findUnique: typeof findUnique; delete: typeof deleteTag } }).personalTag = {
      findUnique,
      delete: deleteTag,
    };
    findUnique.mockResolvedValue({ id: "tag-1", name: "RPG", _count: { games: 3 } });
    deleteTag.mockResolvedValue({});
  });

  it("warns through its result data about affected games", async () => {
    await expect(deletePersonalTag({ tagId: "tag-1" })).resolves.toEqual({
      success: true,
      data: { id: "tag-1", name: "RPG", removedGames: 3 },
      error: null,
    });
    expect(deleteTag).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });

  it("rejects a missing tag", async () => {
    findUnique.mockResolvedValue(null);

    await expect(deletePersonalTag({ tagId: "missing" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Tag not found",
    });
    expect(deleteTag).not.toHaveBeenCalled();
  });
});
