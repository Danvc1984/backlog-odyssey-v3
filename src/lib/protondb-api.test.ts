import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lookupProtonDb, parseProtonDbSummary } from "./protondb-api";

const response = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), { status: 200, ...init });

describe("lookupProtonDb", () => {
  it.each([
    ["native", "READY"],
    ["platinum", "READY"],
    ["gold", "READY"],
    ["silver", "READY_WITH_TINKERING"],
    ["bronze", "FALLBACK_RECOMMENDED"],
    ["borked", "REQUIRED"],
  ])("maps %s to %s", async (tier, status) => {
    const result = await lookupProtonDb("620", vi.fn().mockResolvedValue(response({ confidence: "strong", tier })));

    expect(result).toMatchObject({ appId: "620", tier, status });
  });

  it("maps insufficient confidence to UNKNOWN", async () => {
    const result = await lookupProtonDb("620", vi.fn().mockResolvedValue(response({ confidence: "insufficient", tier: "platinum" })));

    expect(result).toMatchObject({ status: "UNKNOWN" });
  });

  it("parses a persisted summary for the compatibility display", () => {
    expect(parseProtonDbSummary("620", { confidence: "moderate", tier: "silver", score: 0.7 }))
      .toMatchObject({ appId: "620", confidence: "moderate", tier: "silver", status: "READY_WITH_TINKERING" });
    expect(parseProtonDbSummary("620", { confidence: "strong" })).toBeNull();
  });

  it("returns null when ProtonDB has no report", async () => {
    const result = await lookupProtonDb("620", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));

    expect(result).toBeNull();
  });

  it("classifies network, HTTP, and malformed responses", async () => {
    await expect(lookupProtonDb("620", vi.fn().mockRejectedValue(new Error("offline"))))
      .resolves.toMatchObject({ category: "NETWORK" });
    await expect(lookupProtonDb("620", vi.fn().mockResolvedValue(new Response("busy", { status: 503 }))))
      .resolves.toMatchObject({ category: "HTTP", status: 503 });
    await expect(lookupProtonDb("620", vi.fn().mockResolvedValue(response({ tier: "gold" }))))
      .resolves.toMatchObject({ category: "MALFORMED_RESPONSE" });
  });
});
