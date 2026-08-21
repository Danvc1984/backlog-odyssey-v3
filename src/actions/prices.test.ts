import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/itad-config", () => ({ getItadConfig: vi.fn() }));
vi.mock("@/lib/price-refresh", () => ({ runPriceRefresh: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getItadConfig } from "@/lib/itad-config";
import { runPriceRefresh } from "@/lib/price-refresh";
import { getLatestPriceRefresh, updatePrices } from "./prices";

const mockRunUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockRecommendationRunCreate = vi.fn();

function configurePrisma() {
  (prisma as unknown as Record<string, unknown>).priceRefresh = {
    update: mockRunUpdate,
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
  };
  (prisma as unknown as Record<string, unknown>).recommendationRun = {
    create: mockRecommendationRunCreate,
    deleteMany: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePrisma();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (getItadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
    ok: true,
    config: { apiKey: "test-key" },
  });
  (runPriceRefresh as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    runId: "run-1",
  });
  mockFindUnique.mockResolvedValue({
    id: "run-1",
    status: "SUCCESS",
    counts: { total: 2, refreshed: 2, notFound: 0, noOffers: 0, failed: 0, identityRequired: 1 },
    requestedAt: new Date(),
    finishedAt: new Date(),
  });
  mockFindFirst.mockResolvedValue(null);
});

describe("updatePrices", () => {
  it("rejects unauthenticated callers", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));

    const result = await updatePrices();

    expect(result.success).toBe(false);
    expect(runPriceRefresh).not.toHaveBeenCalled();
  });

  it("rejects junk input before doing any work", async () => {
    const result = await updatePrices({ sneaky: true });

    expect(result).toMatchObject({ success: false, error: "Invalid input" });
    expect(runPriceRefresh).not.toHaveBeenCalled();
  });

  it("surfaces a missing ITAD key without starting a run", async () => {
    (getItadConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false,
      error: "ITAD is not configured: set ITAD_API_KEY in the environment",
    });

    const result = await updatePrices();

    expect(result.error).toContain("ITAD is not configured");
    expect(runPriceRefresh).not.toHaveBeenCalled();
  });

  it("returns the finished run after a successful refresh", async () => {
    const result = await updatePrices();

    expect(result.success).toBe(true);
    expect(runPriceRefresh).toHaveBeenCalledWith("test-key");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "run-1" } });
    expect(result.data).toMatchObject({ id: "run-1", status: "SUCCESS" });
  });

  it("surfaces the active run when a refresh is already running", async () => {
    (runPriceRefresh as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: "already-running",
      runId: "run-active",
    });

    const result = await updatePrices();

    expect(result.success).toBe(false);
    expect(result.data).toEqual({ runId: "run-active", reason: "already-running" });
  });
});

describe("getLatestPriceRefresh", () => {
  it("requires an authenticated user", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));

    const result = await getLatestPriceRefresh();

    expect(result.success).toBe(false);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when no run exists", async () => {
    const result = await getLatestPriceRefresh();

    expect(result).toEqual({ success: true, data: null, error: null });
  });

  it("returns the most recent run", async () => {
    const run = { id: "run-9", status: "PARTIAL", requestedAt: new Date(), finishedAt: null };
    mockFindFirst.mockResolvedValue(run);

    const result = await getLatestPriceRefresh();

    expect(mockFindFirst).toHaveBeenCalledWith({ orderBy: { requestedAt: "desc" } });
    expect(result.data).toEqual(run);
  });
});

describe("price/recommendation boundary", () => {
  it("never creates or modifies a recommendation run from any price path", async () => {
    await updatePrices();
    await getLatestPriceRefresh();

    expect(mockRecommendationRunCreate).not.toHaveBeenCalled();
    expect(vi.mocked(runPriceRefresh)).toHaveBeenCalledTimes(1);
  });
});
