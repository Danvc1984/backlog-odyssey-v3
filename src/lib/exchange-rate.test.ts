import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchExchangeRate } from "./exchange-rate";

function response(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), { status: 200, ...init });
}

describe("fetchExchangeRate", () => {
  it("parses a positive MXN rate from the provider", async () => {
    const fetchFn = vi.fn().mockResolvedValue(response({ date: "2026-08-21", base: "USD", quote: "MXN", rate: 16.9282 }));

    await expect(fetchExchangeRate("USD", "MXN", { fetchFn })).resolves.toMatchObject({ ok: true, rate: 16.9282 });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rate/usd/mxn",
      { cache: "no-store" },
    );
  });

  it("rejects malformed or non-positive rates", async () => {
    for (const payload of [{}, { rate: 0 }, { rate: Number.NaN }]) {
      const fetchFn = vi.fn().mockResolvedValue(response(payload));
      await expect(fetchExchangeRate("USD", "MXN", { fetchFn })).resolves.toMatchObject({
        ok: false,
        error: { category: "MALFORMED_RESPONSE" },
      });
    }
  });

  it("surfaces network and HTTP failures", async () => {
    await expect(fetchExchangeRate("USD", "MXN", { fetchFn: vi.fn().mockRejectedValue(new Error("offline")) }))
      .resolves.toMatchObject({ ok: false, error: { category: "NETWORK" } });
    await expect(fetchExchangeRate("USD", "MXN", { fetchFn: vi.fn().mockResolvedValue(response({}, { status: 503 })) }))
      .resolves.toMatchObject({ ok: false, error: { category: "HTTP", status: 503 } });
  });
});
