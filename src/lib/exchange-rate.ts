import "server-only";

const EXCHANGE_RATE_URL =
  "https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN";

export interface ExchangeRateProviderError {
  category: "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
}

interface ExchangeRateFetchOptions {
  fetchFn?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fetchUsdToMxnRate(
  options: ExchangeRateFetchOptions = {},
): Promise<{ ok: true; rate: number; fetchedAt: Date } | { ok: false; error: ExchangeRateProviderError }> {
  const fetchFn = options.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(EXCHANGE_RATE_URL, { cache: "no-store" });
  } catch {
    return { ok: false, error: { category: "NETWORK", message: "Exchange rate provider could not be reached" } };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: { category: "HTTP", message: "Exchange rate provider request failed", status: response.status },
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "Exchange rate response was not valid JSON" } };
  }

  const rates = isRecord(payload) && isRecord(payload.rates) ? payload.rates : null;
  const rate = rates?.MXN;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "Exchange rate response did not contain a valid USD/MXN rate" } };
  }

  return { ok: true, rate, fetchedAt: new Date() };
}
