"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { updateOsSetup } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, type Option } from "@/components/preferences/SegmentedControl";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import type { ThemeFamily } from "@/lib/visual-preferences";
import type { OsSetup } from "@/lib/os-setup";
import type { DurationProfile } from "@/generated/prisma/client";
import { PRICE_MARKETS, DISPLAY_CURRENCIES, type PricePreferences } from "@/lib/price-preferences";
import { parseSteamCallbackStatus } from "@/lib/steam-openid";

const durationOptions = [
  { value: "HASTILY", label: "Main story" },
  { value: "NORMALLY", label: "Main + extras" },
  { value: "COMPLETELY", label: "Completionist" },
] as const;

const themeModeOptions: Option<string>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const familyOptions: Option<ThemeFamily>[] = [
  { value: "dawn", label: "Dawn" },
  { value: "sunset", label: "Sunset" },
];

type WelcomeSteamConnection = { steamId64: string } | null;
type SteamWelcomeStatus = NonNullable<ReturnType<typeof parseSteamCallbackStatus>>;

export function WelcomeSetupForm({
  steamConnection,
}: {
  steamConnection: WelcomeSteamConnection;
}) {
  const [primaryOs, setPrimaryOs] = useState<OsSetup["primaryOs"]>("WINDOWS");
  const [hasWindowsFallback, setHasWindowsFallback] = useState(false);
  const [handheldOs, setHandheldOs] = useState<OsSetup["handheldOs"]>("NONE");
  const [saving, setSaving] = useState(false);
  const [durationProfile, setDurationProfile] = useState<DurationProfile>("NORMALLY");
  const [priceCountry, setPriceCountry] = useState<PricePreferences["priceCountry"]>("US");
  const [displayCurrency, setDisplayCurrency] = useState<PricePreferences["displayCurrency"]>("USD");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [steamConnecting, setSteamConnecting] = useState(false);
  const [steamStatus] = useState<SteamWelcomeStatus | null>(() =>
    parseSteamCallbackStatus(searchParams.get("steam")),
  );
  const { theme, setTheme } = useTheme();
  const { family, setFamily } = useVisualPreferences();

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!steamStatus) {
      return;
    }

    router.replace("/welcome");
  }, [router, steamStatus]);

  const save = async () => {
    setSaving(true);
    const result = await updateOsSetup({ primaryOs, hasWindowsFallback, handheldOs, onboardingCompleted: true, durationProfile, priceCountry, displayCurrency });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not save setup");
      return;
    }
    toast.success("Setup saved");
    router.push("/today");
  };

  const startSteamConnection = () => {
    setSteamConnecting(true);
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="welcome-primary-os">Primary OS</Label>
        <Select value={primaryOs} onValueChange={(value) => { const next = value as OsSetup["primaryOs"]; setPrimaryOs(next); if (next === "WINDOWS") setHasWindowsFallback(false); }}>
          <SelectTrigger id="welcome-primary-os"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LINUX">Linux</SelectItem>
            <SelectItem value="WINDOWS">Windows</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="welcome-duration-profile">Duration profile</Label>
        <Select value={durationProfile} onValueChange={(value) => setDurationProfile(value as DurationProfile)}>
          <SelectTrigger id="welcome-duration-profile"><SelectValue /></SelectTrigger>
          <SelectContent>
            {durationOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Uses IGDB main story, main plus extras, or completionist estimates.</p>
      </div>
      {primaryOs === "LINUX" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasWindowsFallback} onChange={(event) => setHasWindowsFallback(event.target.checked)} className="accent-foreground" />
          I have a Windows fallback
        </label>
      )}
      <div className="grid gap-2">
        <Label htmlFor="welcome-handheld-os">Handheld OS</Label>
        <Select value={handheldOs} onValueChange={(value) => setHandheldOs(value as OsSetup["handheldOs"])}>
          <SelectTrigger id="welcome-handheld-os"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">No handheld</SelectItem>
            <SelectItem value="LINUX">Linux</SelectItem>
            <SelectItem value="WINDOWS">Windows</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">Regional prices</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose where prices are requested and how optional display estimates are shown.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="welcome-price-country">Price market</Label>
            <Select value={priceCountry} onValueChange={(value) => setPriceCountry(value as PricePreferences["priceCountry"])}>
              <SelectTrigger id="welcome-price-country"><SelectValue /></SelectTrigger>
              <SelectContent>{PRICE_MARKETS.map((market) => <SelectItem key={market.country} value={market.country}>{market.label} ({market.country})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="welcome-display-currency">Display currency</Label>
            <Select value={displayCurrency} onValueChange={(value) => setDisplayCurrency(value as PricePreferences["displayCurrency"])}>
              <SelectTrigger id="welcome-display-currency"><SelectValue /></SelectTrigger>
              <SelectContent>{DISPLAY_CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Displayed prices can be estimates converted from the store&apos;s price. If conversion is unavailable, Backlog Odyssey shows the store&apos;s source currency.
        </p>
      </div>
      <div className="grid gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">App theme</p>
        <div className="grid gap-2">
          <Label>Palette family</Label>
          <SegmentedControl value={family} options={familyOptions} onChange={setFamily} label="Palette family" />
        </div>
        <div className="grid gap-2">
          <Label>Theme mode</Label>
          <SegmentedControl
            value={mounted ? theme ?? "system" : "system"}
            options={themeModeOptions}
            onChange={setTheme}
            label="Theme mode"
          />
        </div>
      </div>
      <section className="grid gap-3 rounded-lg border border-border p-4" aria-labelledby="welcome-steam-heading">
        <div>
          <p id="welcome-steam-heading" className="text-sm font-medium">Optional Steam connection</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Link Steam now to make your library available later. Welcome remains complete without it, and no games are imported automatically.
          </p>
        </div>
        {steamConnection ? (
          <div className="rounded-md border border-signal/30 bg-signal/10 p-3 text-sm" role="status" aria-live="polite">
            Steam is connected{steamConnection.steamId64 ? ` (${steamConnection.steamId64})` : ""}.
          </div>
        ) : (
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button asChild>
              <Link
                href="/api/steam/connect?returnTo=welcome"
                prefetch={false}
                onClick={(event) => {
                  if (steamConnecting || saving) {
                    event.preventDefault();
                    return;
                  }
                  startSteamConnection();
                }}
                aria-disabled={steamConnecting || saving}
                tabIndex={steamConnecting || saving ? -1 : undefined}
              >
                {steamConnecting ? "Opening Steam..." : "Connect Steam"}
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">You can connect it later from Settings.</p>
          </div>
        )}
        {steamStatus && (
          <div
            className={steamStatus === "error" ? "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm" : "rounded-md border border-border bg-muted/40 p-3 text-sm"}
            role={steamStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {steamStatus === "connected" && "Steam account linked. Review your choices, then save setup when ready."}
            {steamStatus === "cancelled" && "Steam connection was cancelled. Your setup choices are still available."}
            {steamStatus === "error" && "Steam could not be connected. Your setup choices are still available; you can try again or continue without Steam."}
          </div>
        )}
        <Button type="button" variant="outline" onClick={() => void save()} disabled={saving || steamConnecting}>
          {saving ? "Saving..." : "Continue without Steam"}
        </Button>
      </section>
      <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save setup"}</Button>
    </div>
  );
}
