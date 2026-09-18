import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildEnvelope, buildExportDocument, EXPORT_VERSION, toJsonSafe } from "./export-data";

const createExportDelegates = () => ({
  appSettings: { findUnique: vi.fn().mockResolvedValue(null) },
  game: { findMany: vi.fn().mockResolvedValue([]) },
  libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
  gameAvailability: { findMany: vi.fn().mockResolvedValue([]) },
  externalGameId: { findMany: vi.fn().mockResolvedValue([]) },
  alternativeSource: { findMany: vi.fn().mockResolvedValue([]) },
  personalTag: { findMany: vi.fn().mockResolvedValue([]) },
  gameTag: { findMany: vi.fn().mockResolvedValue([]) },
  wishlistEntry: { findMany: vi.fn().mockResolvedValue([]) },
  unresolvedSteamDlc: { findMany: vi.fn().mockResolvedValue([]) },
  wishlistImportReview: { findMany: vi.fn().mockResolvedValue([]) },
  wishlistImportIgnore: { findMany: vi.fn().mockResolvedValue([]) },
  possibleDuplicate: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationRun: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationItem: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationFeedback: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationEvent: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationProfile: { findUnique: vi.fn().mockResolvedValue(null) },
  recommendationPreference: { findMany: vi.fn().mockResolvedValue([]) },
  recommendationTuneState: { findUnique: vi.fn().mockResolvedValue(null) },
  recommendationPreset: { findMany: vi.fn().mockResolvedValue([]) },
});

type ExportDelegates = ReturnType<typeof createExportDelegates>;

const delegateMethods = (delegates: ExportDelegates) =>
  Object.values(delegates).flatMap((delegate) => Object.values(delegate));

describe("buildExportDocument", () => {
  it("reads every export model through the transaction client", async () => {
    const transactionDelegates = createExportDelegates();
    const globalDelegates = createExportDelegates();
    const transaction = vi.fn().mockImplementation(
      async (callback: (client: ExportDelegates) => unknown) =>
        callback(transactionDelegates),
    );

    Object.assign(prisma, globalDelegates, { $transaction: transaction });

    await buildExportDocument();

    expect(transaction).toHaveBeenCalledOnce();
    for (const method of delegateMethods(transactionDelegates)) {
      expect(method).toHaveBeenCalledOnce();
    }
    for (const method of delegateMethods(globalDelegates)) {
      expect(method).not.toHaveBeenCalled();
    }
  });
});

describe("toJsonSafe", () => {
  it("converts dates to ISO strings", () => {
    const date = new Date("2026-09-04T12:00:00.000Z");
    expect(toJsonSafe(date)).toBe("2026-09-04T12:00:00.000Z");
  });

  it("converts Prisma Decimals to strings", () => {
    expect(toJsonSafe(new Prisma.Decimal("199.99"))).toBe("199.99");
    expect(toJsonSafe(new Prisma.Decimal(0))).toBe("0");
  });

  it("leaves primitives and null intact", () => {
    expect(toJsonSafe("hello")).toBe("hello");
    expect(toJsonSafe(42)).toBe(42);
    expect(toJsonSafe(true)).toBe(true);
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe(undefined)).toBeUndefined();
  });

  it("recurses through arrays and nested objects", () => {
    const value = {
      name: "Portal 2",
      meta: { releasedAt: new Date("2011-04-18T00:00:00.000Z") },
      tags: ["puzzle", null, { id: 5, created: new Date("2020-01-01T00:00:00.000Z") }],
    };
    expect(toJsonSafe(value)).toEqual({
      name: "Portal 2",
      meta: { releasedAt: "2011-04-18T00:00:00.000Z" },
      tags: ["puzzle", null, { id: 5, created: "2020-01-01T00:00:00.000Z" }],
    });
  });
});

describe("buildEnvelope", () => {
  it("wraps data with the export version and an ISO exportedAt", () => {
    const data = { games: [] };
    const envelope = buildEnvelope(data);
    expect(envelope.version).toBe(EXPORT_VERSION);
    expect(envelope.data).toBe(data);
    expect(() => new Date(envelope.exportedAt).toISOString()).not.toThrow();
  });
});
