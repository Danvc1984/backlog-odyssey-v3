import { z } from "zod";

export const PRICE_MARKETS = [
  { country: "MX", currency: "MXN", label: "Mexico" },
  { country: "US", currency: "USD", label: "United States" },
  { country: "CA", currency: "CAD", label: "Canada" },
  { country: "BR", currency: "BRL", label: "Brazil" },
  { country: "CO", currency: "COP", label: "Colombia" },
  { country: "AR", currency: "ARS", label: "Argentina" },
] as const;

export const PRICE_COUNTRIES = ["MX", "US", "CA", "BR", "CO", "AR"] as const;
export const DISPLAY_CURRENCIES = ["MXN", "USD", "CAD", "BRL", "COP", "ARS"] as const;

export const priceCountrySchema = z.enum(PRICE_COUNTRIES);
export const displayCurrencySchema = z.enum(DISPLAY_CURRENCIES);
export const pricePreferencesSchema = z.strictObject({
  priceCountry: priceCountrySchema,
  displayCurrency: displayCurrencySchema,
});

export type PriceCountry = z.infer<typeof priceCountrySchema>;
export type DisplayCurrency = z.infer<typeof displayCurrencySchema>;
export type PricePreferences = z.infer<typeof pricePreferencesSchema>;

export const DEFAULT_PRICE_PREFERENCES: PricePreferences = {
  priceCountry: "MX",
  displayCurrency: "MXN",
};

export function marketForCountry(country: string | null | undefined) {
  return PRICE_MARKETS.find((market) => market.country === country) ?? PRICE_MARKETS[0];
}
