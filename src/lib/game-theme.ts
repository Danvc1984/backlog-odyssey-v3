import type { RawgPalette } from "./rawg-types";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isRawgPalette(value: unknown): value is RawgPalette {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const palette = value as Record<string, unknown>;
  return ["primary", "dark", "muted"].every(
    (key) => typeof palette[key] === "string" && HEX_COLOR_PATTERN.test(palette[key]),
  );
}

export function resolvePagePalette(payload: unknown): RawgPalette | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const palette = (payload as Record<string, unknown>).palette;
  return isRawgPalette(palette) ? palette : null;
}

export function paletteToCssVars(palette: RawgPalette): Record<string, string> {
  return {
    "--game-accent": palette.primary,
    "--game-accent-dark": palette.dark,
    "--game-accent-muted": palette.muted,
  };
}
