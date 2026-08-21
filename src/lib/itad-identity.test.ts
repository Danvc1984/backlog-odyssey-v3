import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./itad-api", () => ({
  chunkItadIds: (ids: string[], size: number) => {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += size) {
      chunks.push(ids.slice(index, index + size));
    }
    return chunks;
  },
  lookupItadIdsByAppIds: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { lookupItadIdsByAppIds } from "./itad-api";
import { resolveItadIds } from "./itad-identity";

const mockFindMany = vi.fn();
const mockTransaction = vi.fn();

function configurePrisma() {
  (prisma as unknown as Record<string, unknown>).itadIdentity = {
    findMany: mockFindMany,
    upsert: vi.fn(),
  };
  (prisma as unknown as { $transaction: typeof mockTransaction }).$transaction =
    mockTransaction;
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePrisma();
  mockFindMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (operations: Promise<unknown>[]) => {
    await Promise.all(operations);
    return [];
  });
  vi.mocked(lookupItadIdsByAppIds).mockResolvedValue(new Map());
});

describe("resolveItadIds", () => {
  it("serves everything from cache without calling ITAD", async () => {
    mockFindMany.mockResolvedValue([
      { steamAppId: "620", itadId: "uuid-620" },
      { steamAppId: "570", itadId: "" },
    ]);

    const result = await resolveItadIds("key", ["620", "570"]);

    expect(result).toBeInstanceOf(Map);
    const mapping = result as Map<string, string | null>;
    expect(mapping.get("620")).toBe("uuid-620");
    expect(mapping.get("570")).toBeNull();
    expect(lookupItadIdsByAppIds).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("queries and caches only the misses", async () => {
    mockFindMany.mockResolvedValue([{ steamAppId: "620", itadId: "uuid-620" }]);
    vi.mocked(lookupItadIdsByAppIds).mockResolvedValue(
      new Map([
        ["7", "uuid-7"],
        ["1", null],
      ]),
    );

    const result = await resolveItadIds("key", ["620", "7", "1"]);

    expect(lookupItadIdsByAppIds).toHaveBeenCalledWith("key", ["7", "1"]);
    const mapping = result as Map<string, string | null>;
    expect(mapping.get("7")).toBe("uuid-7");
    expect(mapping.get("1")).toBeNull();

    const operations = mockTransaction.mock.calls[0][0] as Array<
      ReturnType<typeof vi.fn>
    >;
    expect(operations).toHaveLength(2);
  });

  it("caches null lookups so unknown games are not re-queried", async () => {
    vi.mocked(lookupItadIdsByAppIds).mockResolvedValue(new Map([["999", null]]));

    await resolveItadIds("key", ["999"]);

    const upsert = (prisma as unknown as { itadIdentity: { upsert: ReturnType<typeof vi.fn> } })
      .itadIdentity.upsert;
    expect(upsert).toHaveBeenCalledWith({
      where: { steamAppId: "999" },
      create: { steamAppId: "999", itadId: "" },
      update: { itadId: "" },
    });
  });

  it("deduplicates repeated App IDs before querying", async () => {
    mockFindMany.mockResolvedValue([]);

    await resolveItadIds("key", ["620", "620", "620"]);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { steamAppId: { in: ["620"] } } }),
    );
    expect(lookupItadIdsByAppIds).toHaveBeenCalledWith("key", ["620"]);
  });

  it("returns the provider error when ITAD lookup fails", async () => {
    vi.mocked(lookupItadIdsByAppIds).mockResolvedValue({
      category: "HTTP",
      message: "ITAD request failed",
      status: 500,
    });

    const result = await resolveItadIds("key", ["620"]);

    expect(result).toMatchObject({ category: "HTTP" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
