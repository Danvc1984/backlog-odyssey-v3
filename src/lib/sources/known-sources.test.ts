import { describe, expect, it } from "vitest";
import {
  FALLBACK_SOURCE_ICON,
  KNOWN_SOURCES,
  UNSPECIFIED_OTHER_SOURCE_NAME,
  availabilitySourcePresentation,
  matchKnownSource,
  normalizeSourceName,
  resolveSourcePresentation,
  suggestSources,
} from "./known-sources";

describe("normalizeSourceName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSourceName("  GOG  ")).toBe("gog");
  });

  it("collapses internal whitespace runs", () => {
    expect(normalizeSourceName("Epic\t Games\n  Store")).toBe("epic games store");
  });

  it("lowercases the result", () => {
    expect(normalizeSourceName("HUMBLE Bundle")).toBe("humble bundle");
  });
});

describe("matchKnownSource", () => {
  it("matches canonical labels regardless of case and spacing", () => {
    expect(matchKnownSource("epic games store")?.key).toBe("EPIC_GAMES_STORE");
    expect(matchKnownSource("  EA app  ")?.key).toBe("EA_APP");
  });

  it("matches aliases like EGS and Origin", () => {
    expect(matchKnownSource("EGS")?.key).toBe("EPIC_GAMES_STORE");
    expect(matchKnownSource("egs")?.key).toBe("EPIC_GAMES_STORE");
    expect(matchKnownSource("Origin")?.key).toBe("EA_APP");
  });

  it("resolves every registry entry through its own label", () => {
    for (const source of KNOWN_SOURCES) {
      expect(matchKnownSource(source.label)?.key).toBe(source.key);
    }
  });

  it("returns null for unknown or empty names", () => {
    expect(matchKnownSource("Some Other Store")).toBeNull();
    expect(matchKnownSource("")).toBeNull();
    expect(matchKnownSource("   ")).toBeNull();
  });

  it("does not resolve when only part of a name matches", () => {
    expect(matchKnownSource("Game Store")).toBeNull();
  });
});

describe("resolveSourcePresentation", () => {
  it("returns the canonical label and icon for a known source", () => {
    expect(resolveSourcePresentation("EGS")).toEqual({
      label: "Epic Games Store",
      iconName: "Sparkles",
    });
    expect(resolveSourcePresentation("Origin")).toEqual({
      label: "EA app",
      iconName: "Gamepad2",
    });
  });

  it("keeps a custom source label with the fallback icon", () => {
    expect(resolveSourcePresentation("  My Custom Store  ")).toEqual({
      label: "My Custom Store",
      iconName: FALLBACK_SOURCE_ICON,
    });
  });

  it("falls back to the unspecified name for an empty label", () => {
    expect(resolveSourcePresentation("")).toEqual({
      label: UNSPECIFIED_OTHER_SOURCE_NAME,
      iconName: FALLBACK_SOURCE_ICON,
    });
  });
});

describe("availabilitySourcePresentation", () => {
  it("uses fixed presentations for Steam and ROM", () => {
    expect(availabilitySourcePresentation("STEAM", null)).toEqual({
      label: "Steam",
      iconName: "MonitorPlay",
    });
    expect(availabilitySourcePresentation("ROM", null)).toEqual({
      label: "ROM",
      iconName: "Disc3",
    });
  });

  it("resolves alternative sources through their saved name", () => {
    expect(availabilitySourcePresentation("OTHER_PLATFORM", "EGS")).toEqual({
      label: "Epic Games Store",
      iconName: "Sparkles",
    });
    expect(
      availabilitySourcePresentation("OTHER_PLATFORM", "  My Custom Store  "),
    ).toEqual({
      label: "My Custom Store",
      iconName: FALLBACK_SOURCE_ICON,
    });
  });

  it("uses the generic Other platform fallback when no name is available", () => {
    expect(availabilitySourcePresentation("OTHER_PLATFORM", null)).toEqual({
      label: "Other platform",
      iconName: FALLBACK_SOURCE_ICON,
    });
  });
});

describe("suggestSources", () => {
  it("matches aliases and returns the canonical known source", () => {
    expect(suggestSources("EGS", []).known).toEqual([
      expect.objectContaining({ key: "EPIC_GAMES_STORE", label: "Epic Games Store" }),
    ]);
  });

  it("detects a saved source through its canonical label or alias", () => {
    expect(suggestSources("EGS", [{ name: "Epic Games Store" }])).toEqual({
      known: [],
      matchesSaved: true,
    });
    expect(suggestSources("Epic Games Store", [{ name: "EGS" }]).matchesSaved).toBe(true);
  });

  it("returns every unsaved known source for an empty query", () => {
    const result = suggestSources("", [{ name: "GOG" }]);

    expect(result.matchesSaved).toBe(false);
    expect(result.known.map((source) => source.key)).not.toContain("GOG");
    expect(result.known).toHaveLength(KNOWN_SOURCES.length - 1);
  });
});
