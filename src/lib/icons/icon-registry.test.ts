import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HouseIcon } from "@phosphor-icons/react/ssr";
import { SignOutIcon, type Icon } from "@phosphor-icons/react";
import { FALLBACK_SOURCE_ICON } from "@/lib/sources/known-sources";
import {
  LEGACY_FALLBACK_ICON_NAME,
  LEGACY_ICON_REGISTRY,
  ODYSSEY_ICON_WEIGHT,
  resolveLegacyIcon,
} from "./icon-registry";

const EXPECTED_LEGACY_KEYS: readonly string[] = [
  "Box",
  "Sparkles",
  "Ghost",
  "Gamepad2",
  "Gamepad",
  "Orbit",
  "Swords",
  "Palette",
  "Package",
  "Gift",
  "Star",
  "MonitorPlay",
  "Disc3",
  "Home",
  "Library",
  "FolderOpen",
  "Heart",
  "Settings",
  "LogOut",
  "Copy",
  "Clock",
  "RotateCcw",
  "EyeOff",
  "Flag",
  "Folder",
  "Calculator",
  "ChevronDown",
  "ChevronDownIcon",
  "ChevronUp",
  "ChevronUpIcon",
  "TriangleAlert",
  "TriangleAlertIcon",
  "Link2",
  "X",
  "XIcon",
  "Search",
  "Plus",
  "RefreshCw",
  "Loader2",
  "Loader2Icon",
  "Download",
  "Check",
  "CheckIcon",
  "Trash2",
  "WandSparkles",
  "Import",
  "Unplug",
  "FolderPlus",
  "SlidersHorizontal",
  "ScanSearch",
  "Pencil",
  "Shuffle",
  "Play",
  "ExternalLink",
  "GitMerge",
  "CircleSlash",
  "Upload",
  "Tag",
  "CircleCheckIcon",
  "InfoIcon",
  "OctagonXIcon",
];

describe("legacy icon registry", () => {
  it("maps every known source and system icon key to a Phosphor component", () => {
    for (const key of EXPECTED_LEGACY_KEYS) {
      expect(LEGACY_ICON_REGISTRY[key], `missing mapping for "${key}"`).toBeDefined();
    }
  });

  it("keeps the legacy fallback key resolvable", () => {
    expect(LEGACY_FALLBACK_ICON_NAME).toBe(FALLBACK_SOURCE_ICON);
    expect(resolveLegacyIcon(LEGACY_FALLBACK_ICON_NAME)).toBe(
      LEGACY_ICON_REGISTRY[LEGACY_FALLBACK_ICON_NAME],
    );
  });

  it("resolves every mapped key through resolveLegacyIcon", () => {
    for (const key of Object.keys(LEGACY_ICON_REGISTRY)) {
      expect(resolveLegacyIcon(key)).not.toBeUndefined();
    }
  });

  it("falls back to the neutral icon for unknown and empty keys", () => {
    const fallback = LEGACY_ICON_REGISTRY[LEGACY_FALLBACK_ICON_NAME];
    expect(resolveLegacyIcon("Swords-Undefined-Key")).toBe(fallback);
    expect(resolveLegacyIcon("")).toBe(fallback);
  });

  it("defaults the Odyssey icon weight to regular", () => {
    expect(ODYSSEY_ICON_WEIGHT).toBe("regular");
  });

  it("renders one isolated Phosphor icon from the server-safe entry", () => {
    const markup = renderToStaticMarkup(createElement(HouseIcon, { "aria-hidden": true }));
    expect(markup).toContain("<svg");
    expect(markup).toContain("aria-hidden");
  });

  it("renders one isolated Phosphor icon from the client entry", () => {
    const IconComponent: Icon = SignOutIcon;
    const markup = renderToStaticMarkup(createElement(IconComponent, { "aria-hidden": true }));
    expect(markup).toContain("<svg");
    expect(markup).toContain("aria-hidden");
  });
});