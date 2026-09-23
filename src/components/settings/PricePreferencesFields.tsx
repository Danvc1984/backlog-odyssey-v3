import { PRICE_MARKETS, DISPLAY_CURRENCIES, type PricePreferences } from "@/lib/price-preferences";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PricePreferencesFields({
  value,
  onChange,
  disabled = false,
}: {
  value: PricePreferences;
  onChange: (value: PricePreferences) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="environment-price-country">Price market</Label>
        <Select
          value={value.priceCountry}
          disabled={disabled}
          onValueChange={(priceCountry) => onChange({ ...value, priceCountry: priceCountry as PricePreferences["priceCountry"] })}
        >
          <SelectTrigger id="environment-price-country"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRICE_MARKETS.map((market) => <SelectItem key={market.country} value={market.country}>{market.label} ({market.country})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="environment-display-currency">Display currency</Label>
        <Select
          value={value.displayCurrency}
          disabled={disabled}
          onValueChange={(displayCurrency) => onChange({ ...value, displayCurrency: displayCurrency as PricePreferences["displayCurrency"] })}
        >
          <SelectTrigger id="environment-display-currency"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DISPLAY_CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
