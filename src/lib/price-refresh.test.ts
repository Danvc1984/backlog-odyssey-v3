import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./itad-api", () => ({
  chunkItadIds: (items: unknown[], size = 200) => {
    const chunks: unknown[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  },
  fetchItadPrices: vi.fn(),
}));
vi.mock("./itad-identity", () => ({
  resolveItadIds: vi.fn(),
}));

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchItadPrices } from "./itad-api";
import { resolveItadIds } from "./itad-identity";
import {
  emptyCounts,
  finalizePriceRefresh,
  processPriceRefreshEntries,
  refreshStatusFromCounts,
  startPriceRefresh,
} from "./price-refresh";

const mockFindFirstRunning = vi.fn();
const mockRunFindFirst = vi.fn();
const mockPriceRefreshFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockEntryFindMany = vi.fn();
const mockRunCreate = vi.fn();
const mockRunUpdate = vi.fn();
const mockWishlistCount = vi.fn();
const mockTransaction = vi.fn();
const txDealDelete = vi.fn();
const txDealCreate = vi.fn();

function configurePrisma() {
  mockPriceRefreshFindFirst.mockImplementation(
    (args: { where: { status?: string; requestedAt?: unknown } }) => {
      if (args.where.requestedAt !== undefined) {
        return mockFindFirstRunning();
      }
      return mockRunFindFirst();
    },
  );
  (prisma as unknown as Record<string, unknown>).priceRefresh = {
    findFirst: mockPriceRefreshFindFirst,
    create: mockRunCreate,
    update: mockRunUpdate,
    updateMany: mockUpdateMany,
  };
  (prisma as unknown as Record<string, unknown>).wishlistEntry = {
    findMany: mockEntryFindMany,
    count: mockWishlistCount,
  };
  (prisma as unknown as { $transaction: typeof mockTransaction }).$transaction =
    mockTransaction;
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      dealOffer: { deleteMany: txDealDelete, createMany: txDealCreate },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePrisma();
  mockFindFirstRunning.mockResolvedValue(null);
  mockUpdateMany.mockResolvedValue({ count: 0 });
  mockEntryFindMany.mockResolvedValue([]);
  mockWishlistCount.mockResolvedValue(0);
  txDealDelete.mockResolvedValue({ count: 0 });
  txDealCreate.mockResolvedValue({ count: 0 });
  mockRunCreate.mockResolvedValue({ id: "run-1" });
  mockRunFindFirst.mockResolvedValue({ id: "run-active" });
  mockRunUpdate.mockResolvedValue({ id: "run-1" });
});

const now = new Date("2026-08-21T18:00:00.000Z");

describe("startPriceRefresh", () => {
  it("claims the run and snapshots eligible entries", async () => {
    mockEntryFindMany.mockResolvedValue([
      { id: "w1", name: "Portal 2", steamAppId: "620" },
      { id: "w2", name: "No identity", steamAppId: null },
    ]);

    const result = await startPriceRefresh(now);

    expect(result).toEqual({
      ok: true,
      runId: "run-1",
      entries: [{ id: "w1", name: "Portal 2", steamAppId: "620" }],
    });
    expect(mockEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { steamAppId: { not: null }, steamAppIdProvenance: { not: null } },
      }),
    );
    expect(mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RUNNING", country: "MX", counts: emptyCounts(1) } }),
    );
  });

  it("refuses with the active run when one is RUNNING", async () => {
    mockRunCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const result = await startPriceRefresh(now);

    expect(result).toEqual({ ok: false, reason: "already-running", runId: "run-active" });
  });

  it("recovers an abandoned run before claiming", async () => {
    mockFindFirstRunning.mockResolvedValue({ id: "run-stale" });

    await startPriceRefresh(now);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-stale", status: "RUNNING" },
        data: { status: "FAILED", finishedAt: now },
      }),
    );
  });

  it("only treats runs older than the 15-minute window as abandoned", async () => {
    const younger = new Date(now.getTime() - 60 * 1000);

    await startPriceRefresh(younger);

    expect(mockFindFirstRunning).toHaveBeenCalledTimes(1);
    const call = mockPriceRefreshFindFirst.mock.calls[0][0] as {
      where: { requestedAt: { lt: Date } };
    };
    expect(call.where.requestedAt.lt.getTime()).toBe(younger.getTime() - 15 * 60 * 1000);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("refreshStatusFromCounts", () => {
  it("chooses SUCCESS, PARTIAL, and FAILED per the contract", () => {
    expect(refreshStatusFromCounts({ ...emptyCounts(3), refreshed: 3 })).toBe("SUCCESS");
    expect(refreshStatusFromCounts({ ...emptyCounts(0) })).toBe("SUCCESS");
    expect(
      refreshStatusFromCounts({ ...emptyCounts(4), refreshed: 2, failed: 1, identityRequired: 1 }),
    ).toBe("PARTIAL");
    expect(refreshStatusFromCounts({ ...emptyCounts(2), failed: 2 })).toBe("FAILED");
    expect(refreshStatusFromCounts({ ...emptyCounts(1), identityRequired: 1 })).toBe("FAILED");
  });
});

describe("finalizePriceRefresh", () => {
  it("persists terminal status, counts, and finishedAt", async () => {
    await finalizePriceRefresh("run-1", { ...emptyCounts(2), refreshed: 1, notFound: 1 });

    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "SUCCESS",
          counts: { total: 2, refreshed: 1, notFound: 1, noOffers: 0, failed: 0, identityRequired: 0 },
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe("processPriceRefreshEntries", () => {
  const entry = (id: string, appId: string) => ({ id, name: `Game ${id}`, steamAppId: appId });

  beforeEach(() => {
    vi.mocked(resolveItadIds).mockResolvedValue(new Map());
    vi.mocked(fetchItadPrices).mockResolvedValue([]);
  });

  it("counts identity-required entries outside the eligible set", async () => {
    mockWishlistCount.mockResolvedValue(5);
    vi.mocked(resolveItadIds).mockResolvedValue(new Map([["620", "uuid-620"]]));
    vi.mocked(fetchItadPrices).mockResolvedValue([
      { itadId: "uuid-620", historyLow: 99.5, deals: [{ shop: { id: 61, name: "Steam" } } as never] },
    ]);

    const counts = await processPriceRefreshEntries("key", [entry("w1", "620")]);

    expect(counts).toEqual({
      total: 5,
      refreshed: 1,
      notFound: 0,
      noOffers: 0,
      failed: 0,
      identityRequired: 4,
    });
  });

  it("marks every eligible entry failed when the identity lookup errors", async () => {
    mockWishlistCount.mockResolvedValue(2);
    vi.mocked(resolveItadIds).mockResolvedValue({
      category: "HTTP",
      message: "ITAD request failed",
      status: 500,
    });

    const counts = await processPriceRefreshEntries("key", [entry("w1", "620"), entry("w2", "7")]);

    expect(counts.failed).toBe(2);
    expect(fetchItadPrices).not.toHaveBeenCalled();
  });

  it("classifies notFound, noOffers, and refreshed in one mixed run", async () => {
    mockWishlistCount.mockResolvedValue(3);
    vi.mocked(resolveItadIds).mockResolvedValue(
      new Map([
        ["620", "uuid-620"],
        ["7", "uuid-7"],
        ["1", null],
      ]),
    );
    vi.mocked(fetchItadPrices).mockResolvedValue([
      { itadId: "uuid-620", historyLow: 99.5, deals: [{} as never] },
      { itadId: "uuid-7", historyLow: null, deals: [] },
    ]);

    const counts = await processPriceRefreshEntries("key", [
      entry("w1", "620"),
      entry("w2", "7"),
      entry("w3", "1"),
    ]);

    expect(counts).toMatchObject({ total: 3, refreshed: 1, noOffers: 1, notFound: 1 });
    expect(txDealDelete).toHaveBeenCalledTimes(1);
    expect(txDealDelete).toHaveBeenCalledWith({
      where: { wishlistEntryId: { in: ["w1", "w2"] } },
    });
    expect(txDealCreate).toHaveBeenCalledTimes(1);
    const created = txDealCreate.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      wishlistEntryId: "w1",
      shop: "Unknown shop",
      country: "MX",
      historicalLow: expect.anything(),
      fetchedAt: expect.any(Date),
    });
  });

  it("fails only the chunk when ITAD prices fail, keeping other entries persisted", async () => {
    mockWishlistCount.mockResolvedValue(2);
    vi.mocked(resolveItadIds).mockResolvedValue(
      new Map([
        ["620", "uuid-620"],
        ["7", "uuid-7"],
      ]),
    );
    vi.mocked(fetchItadPrices).mockRejectedValueOnce({
      category: "NETWORK",
      message: "offline",
    });
    vi.mocked(fetchItadPrices).mockResolvedValueOnce([
      { itadId: "uuid-620", historyLow: null, deals: [{ shop: { id: 61, name: "Steam" }, price: 100, currency: "MXN" } as never] },
    ]);

    // Both ids land in one chunk, so the single failing call fails both.
    const counts = await processPriceRefreshEntries("key", [entry("w1", "620"), entry("w2", "7")]);

    expect(counts.failed).toBe(2);
    expect(txDealCreate).not.toHaveBeenCalled();
  });

  it("keeps later chunks when an earlier chunk's persistence fails", async () => {
    mockWishlistCount.mockResolvedValue(201);
    vi.mocked(resolveItadIds).mockResolvedValue(new Map([["620", "uuid-620"]]));
    vi.mocked(fetchItadPrices).mockResolvedValue([
      {
        itadId: "uuid-620",
        historyLow: null,
        deals: [{ shop: { id: 61, name: "Steam" }, price: 100, currency: "MXN" } as never],
      },
    ]);
    mockTransaction.mockReset();
    txDealDelete.mockResolvedValue({ count: 0 });
    txDealCreate.mockResolvedValue({ count: 0 });
    mockTransaction
      .mockImplementationOnce(async () => {
        throw new Error("db down");
      })
      .mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ dealOffer: { deleteMany: txDealDelete, createMany: txDealCreate } }),
      );
    const entries = Array.from({ length: 201 }, (_, index) => entry(`w${index + 1}`, "620"));

    const counts = await processPriceRefreshEntries("key", entries);

    expect(counts).toMatchObject({ total: 201, failed: 200, refreshed: 1 });
    const lastDelete = txDealDelete.mock.calls.at(-1)?.[0] as {
      where: { wishlistEntryId: { in: string[] } };
    };
    expect(lastDelete.where.wishlistEntryId.in).toEqual(["w201"]);
    expect(txDealCreate).toHaveBeenCalledTimes(1);
    const created = txDealCreate.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ wishlistEntryId: "w201" });
  });

  it("shares one fetch timestamp across a chunk's rows", async () => {
    mockWishlistCount.mockResolvedValue(2);
    vi.mocked(resolveItadIds).mockResolvedValue(new Map([["620", "uuid-620"]]));
    vi.mocked(fetchItadPrices).mockResolvedValue([
      {
        itadId: "uuid-620",
        historyLow: null,
        deals: [
          { shop: { id: 61, name: "Steam" }, price: 100, currency: "MXN" } as never,
          { shop: { id: 62, name: "Fanatical" }, price: 90, currency: "MXN" } as never,
        ],
      },
    ]);

    await processPriceRefreshEntries("key", [entry("w1", "620"), entry("w2", "620")]);

    const created = txDealCreate.mock.calls[0][0].data as Array<{ fetchedAt: Date }>;
    expect(created).toHaveLength(4);
    const stamps = new Set(created.map((row) => row.fetchedAt.getTime()));
    expect(stamps.size).toBe(1);
  });
});
