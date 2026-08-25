import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchUsdToMxnRate } from "./exchange-rate";

function response(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), { status: 200, ...init });
}

describe("fetchUsdToMxnRate", () => {
  it("parses a positive MXN rate from the provider", async () => {
    const fetchFn = vi.fn().mockResolvedValue(response({ rates: { MXN: 16.9282 } }));

    await expect(fetchUsdToMxnRate({ fetchFn })).resolves.toMatchObject({ ok: true, rate: 16.9282 });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN",
      { cache: "no-store" },
    );
  });

  it("rejects malformed or non-positive rates", async () => {
    for (const payload of [{ rates: {} }, { rates: { MXN: 0 } }, { rates: { MXN: Number.NaN } }]) {
      const fetchFn = vi.fn().mockResolvedValue(response(payload));
      await expect(fetchUsdToMxnRate({ fetchFn })).resolves.toMatchObject({
        ok: false,
        error: { category: "MALFORMED_RESPONSE" },
      });
    }
  });

  it("surfaces network and HTTP failures", async () => {
    await expect(fetchUsdToMxnRate({ fetchFn: vi.fn().mockRejectedValue(new Error("offline")) }))
      .resolves.toMatchObject({ ok: false, error: { category: "NETWORK" } });
    await expect(fetchUsdToMxnRate({ fetchFn: vi.fn().mockResolvedValue(response({}, { status: 503 })) }))
      .resolves.toMatchObject({ ok: false, error: { category: "HTTP", status: 503 } });
  });
});
