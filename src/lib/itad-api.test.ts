import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkItadIds,
  fetchItadPrices,
  lookupItadIdsByAppIds,
} from "./itad-api";

vi.mock("server-only", () => ({}));

  const lookupResponse = (mapping: Record<string, unknown>) =>
    new Response(JSON.stringify(mapping), { status: 200 });

describe("lookupItadIdsByAppIds", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts app keys to the Steam shop lookup and maps results", async () => {
    fetchMock.mockResolvedValue(
      lookupResponse({ "app/620": "018d-uuid-620", "app/1": null }),
    );

    const result = await lookupItadIdsByAppIds("key", ["620", "1"], { fetchFn: fetchMock });

    expect(result).toBeInstanceOf(Map);
    const mapping = result as Map<string, string | null>;
    expect(mapping.get("620")).toBe("018d-uuid-620");
    expect(mapping.get("1")).toBeNull();

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/lookup/id/shop/61/v1");
    expect(url.searchParams.get("key")).toBe("key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(["app/620", "app/1"]);
  });

  it("treats malformed values as not found", async () => {
    fetchMock.mockResolvedValue(lookupResponse({ "app/620": 42, "app/7": "" }));

    const result = await lookupItadIdsByAppIds("key", ["620", "7"], { fetchFn: fetchMock });

    const mapping = result as Map<string, string | null>;
    expect(mapping.get("620")).toBeNull();
    expect(mapping.get("7")).toBeNull();
  });

  it("returns an empty map without work instead of calling ITAD", async () => {
    const empty = await lookupItadIdsByAppIds("key", [], { fetchFn: fetchMock });
    expect(empty).toBeInstanceOf(Map);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies auth failures as configuration errors", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));

    const result = await lookupItadIdsByAppIds("bad", ["620"], { fetchFn: fetchMock });

    expect(result).toMatchObject({ category: "CONFIGURATION", status: 403 });
  });
});

describe("chunkItadIds", () => {
  it("splits into bounded chunks and keeps order", () => {
    const ids = Array.from({ length: 450 }, (_, index) => String(index));
    const chunks = chunkItadIds(ids);

    expect(chunks.map((chunk) => chunk.length)).toEqual([200, 200, 50]);
    expect(chunks.flat()).toEqual(ids);
  });
});

describe("fetchItadPrices", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const gamePayload = (id: string) => ({
    id,
    historyLow: { all: { amount: 4.99, amountInt: 499, currency: "MXN" } },
    deals: [
      {
        shop: { id: 61, name: "Steam" },
        price: { amount: 9.99, amountInt: 999, currency: "MXN" },
        regular: { amount: 19.99, amountInt: 1999, currency: "MXN" },
        cut: 50,
        voucher: null,
        storeLow: { amount: 4.99, amountInt: 499, currency: "MXN" },
        flag: null,
        drm: [{ id: 61, name: "Steam" }],
        platforms: [{ id: 1, name: "Windows" }],
        timestamp: "2026-08-21T12:00:00+01:00",
        expiry: null,
        url: "https://itad.link/x/",
      },
      { garbage: true },
    ],
  });

  it("normalizes games and skips malformed deals", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([gamePayload("uuid-a"), { broken: 1 }]), { status: 200 }),
    );

    const result = await fetchItadPrices("key", ["uuid-a"], { fetchFn: fetchMock });

    expect(result).toEqual([
      {
        itadId: "uuid-a",
        historyLow: 4.99,
        deals: [
          {
            shopId: 61,
            shopName: "Steam",
            price: 9.99,
            currency: "MXN",
            regular: 19.99,
            cut: 50,
            voucher: null,
            storeLow: 4.99,
            flag: null,
            drm: ["Steam"],
            platforms: [{ id: 1, name: "Windows" }],
            timestamp: "2026-08-21T12:00:00+01:00",
            expiry: null,
            url: "https://itad.link/x/",
          },
        ],
      },
    ]);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/games/prices/v3");
    expect(url.searchParams.get("country")).toBe("MX");
    expect(url.searchParams.has("deals")).toBe(false);
  });

  it("chunks more than 200 ids across sequential requests", async () => {
    fetchMock.mockImplementation(() => new Response(JSON.stringify([]), { status: 200 }));
    const ids = Array.from({ length: 450 }, (_, index) => `uuid-${index}`);

    await fetchItadPrices("key", ids, { fetchFn: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody).toHaveLength(200);
    expect(secondBody).toHaveLength(200);
  });

  it("returns a network error when ITAD cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await fetchItadPrices("key", ["uuid-a"], { fetchFn: fetchMock });

    expect(result).toMatchObject({ category: "NETWORK" });
  });

  it("returns an empty array without work instead of calling ITAD", async () => {
    const result = await fetchItadPrices("key", [], { fetchFn: fetchMock });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
