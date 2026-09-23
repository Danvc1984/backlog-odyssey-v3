import "server-only";
import { DISPLAY_CURRENCIES, type DisplayCurrency } from "./price-preferences";

const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate";

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

export async function fetchExchangeRate(
  sourceCurrency: string,
  displayCurrency: string,
  options: ExchangeRateFetchOptions = {},
): Promise<{ ok: true; rate: number; fetchedAt: Date } | { ok: false; error: ExchangeRateProviderError }> {
  const source = sourceCurrency.trim().toUpperCase();
  const display = displayCurrency.trim().toUpperCase();
  if (
    source === display &&
    DISPLAY_CURRENCIES.includes(source as DisplayCurrency)
  ) {
    return { ok: true, rate: 1, fetchedAt: new Date() };
  }
  if (
    !DISPLAY_CURRENCIES.includes(source as DisplayCurrency) ||
    !DISPLAY_CURRENCIES.includes(display as DisplayCurrency)
  ) {
    return {
      ok: false,
      error: { category: "MALFORMED_RESPONSE", message: "Exchange rate pair is not supported" },
    };
  }
  const fetchFn = options.fetchFn ?? fetch;
  const url = `${EXCHANGE_RATE_URL}/${source.toLowerCase()}/${display.toLowerCase()}`;
  let response: Response;
  try {
    response = await fetchFn(url, { cache: "no-store" });
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

  const rate = isRecord(payload) ? payload.rate : null;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "Exchange rate response did not contain a valid rate" } };
  }

  return { ok: true, rate, fetchedAt: new Date() };
}

export async function fetchUsdToMxnRate(
  options: ExchangeRateFetchOptions = {},
) {
  return fetchExchangeRate("USD", "MXN", options);
}
