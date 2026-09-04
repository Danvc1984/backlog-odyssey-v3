import { SectionCard } from "@/components/ui/detail-card";

const ENVIRONMENT_DEFAULTS = {
  desktopOs: "BAZZITE",
  portableDevice: "STEAM_DECK",
  fallbackOs: "WINDOWS",
  priceCountry: "MX",
  timeZone: "America/Mexico_City",
} as const;

const ENVIRONMENT_LABELS: Record<string, string> = {
  BAZZITE: "Bazzite",
  STEAM_DECK: "Steam Deck",
  WINDOWS: "Windows",
  MX: "MX",
  "America/Mexico_City": "America/Mexico_City",
};

function environmentValue(key: keyof typeof ENVIRONMENT_DEFAULTS, value: string | null | undefined): string {
  const resolved = value ?? ENVIRONMENT_DEFAULTS[key];
  return ENVIRONMENT_LABELS[resolved] ?? resolved;
}

interface EnvironmentSettings {
  desktopOs: string | null;
  portableDevice: string | null;
  fallbackOs: string | null;
  priceCountry: string | null;
  timeZone: string | null;
}

export function EnvironmentCard({ settings }: { settings: EnvironmentSettings | null }) {
  const rows = [
    { label: "Desktop OS", value: environmentValue("desktopOs", settings?.desktopOs) },
    { label: "Portable device", value: environmentValue("portableDevice", settings?.portableDevice) },
    { label: "Fallback OS", value: environmentValue("fallbackOs", settings?.fallbackOs) },
    { label: "Price country", value: environmentValue("priceCountry", settings?.priceCountry) },
    { label: "Time zone", value: environmentValue("timeZone", settings?.timeZone) },
  ];

  return (
    <SectionCard
      eyebrow="Environment"
      title="Fixed environment"
      description="Context used for compatibility, prices, and scheduling."
    >
      <dl className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
