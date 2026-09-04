import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { buildEnvelope, EXPORT_VERSION, toJsonSafe } from "./export-data";

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
