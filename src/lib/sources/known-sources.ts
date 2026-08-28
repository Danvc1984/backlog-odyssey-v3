export interface KnownSource {
  key: string;
  label: string;
  aliases: readonly string[];
  iconName: string;
}

export const UNSPECIFIED_OTHER_SOURCE_NAME = "Unspecified other source";

export const FALLBACK_SOURCE_ICON = "Box";

export const KNOWN_SOURCES: readonly KnownSource[] = [
  {
    key: "EPIC_GAMES_STORE",
    label: "Epic Games Store",
    aliases: ["EGS", "Epic"],
    iconName: "Sparkles",
  },
  {
    key: "GOG",
    label: "GOG",
    aliases: ["Good Old Games"],
    iconName: "Ghost",
  },
  {
    key: "EA_APP",
    label: "EA app",
    aliases: ["Origin", "EA Desktop", "EA"],
    iconName: "Gamepad2",
  },
  {
    key: "UBISOFT_CONNECT",
    label: "Ubisoft Connect",
    aliases: ["Uplay", "Ubisoft"],
    iconName: "Orbit",
  },
  {
    key: "BATTLE_NET",
    label: "Battle.net",
    aliases: ["Blizzard", "Battle.net App"],
    iconName: "Swords",
  },
  {
    key: "XBOX_MICROSOFT_STORE",
    label: "Xbox/Microsoft Store",
    aliases: ["Xbox", "Microsoft Store", "MS Store"],
    iconName: "Gamepad",
  },
  {
    key: "ITCH_IO",
    label: "itch.io",
    aliases: ["itch"],
    iconName: "Palette",
  },
  {
    key: "AMAZON_GAMES",
    label: "Amazon Games",
    aliases: ["Amazon"],
    iconName: "Package",
  },
  {
    key: "HUMBLE_BUNDLE",
    label: "Humble Bundle",
    aliases: ["Humble", "Humble Choice"],
    iconName: "Gift",
  },
  {
    key: "ROCKSTAR_GAMES_LAUNCHER",
    label: "Rockstar Games Launcher",
    aliases: ["Rockstar", "Social Club", "RGL"],
    iconName: "Star",
  },
];

export function normalizeSourceName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function matchKnownSource(name: string): KnownSource | null {
  const normalized = normalizeSourceName(name);
  if (!normalized) return null;
  return (
    KNOWN_SOURCES.find(
      (source) =>
        normalizeSourceName(source.label) === normalized ||
        source.aliases.some((alias) => normalizeSourceName(alias) === normalized),
    ) ?? null
  );
}

export function resolveSourcePresentation(name: string): {
  label: string;
  iconName: string;
} {
  const known = matchKnownSource(name);
  if (known) return { label: known.label, iconName: known.iconName };
  const trimmed = name.trim();
  return {
    label: trimmed || UNSPECIFIED_OTHER_SOURCE_NAME,
    iconName: FALLBACK_SOURCE_ICON,
  };
}