import { Vibrant } from "node-vibrant/node";

import type { RawgPalette } from "./rawg-types";

type PaletteSwatchName =
  | "Vibrant"
  | "Muted"
  | "DarkVibrant"
  | "DarkMuted"
  | "LightVibrant"
  | "LightMuted";

interface PaletteSwatch {
  hex: string;
}

export type RawgPaletteSwatches = Partial<
  Record<PaletteSwatchName, PaletteSwatch | null>
>;

const SWATCH_NAMES: PaletteSwatchName[] = [
  "Vibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
];

function firstHex(
  swatches: RawgPaletteSwatches,
  names: PaletteSwatchName[],
): string | null {
  for (const name of names) {
    const hex = swatches[name]?.hex;
    if (hex) {
      return hex;
    }
  }
  return null;
}

export function selectPaletteFromSwatches(
  swatches: RawgPaletteSwatches,
): RawgPalette | null {
  const primary = firstHex(swatches, ["Vibrant", "DarkVibrant", ...SWATCH_NAMES]);
  if (!primary) {
    return null;
  }

  return {
    primary,
    dark: firstHex(swatches, ["DarkVibrant", "DarkMuted"]) ?? primary,
    muted: firstHex(swatches, ["Muted", "LightMuted"]) ?? primary,
  };
}

export async function extractPaletteFromImageBytes(
  imageBytes: Buffer,
): Promise<RawgPalette | null> {
  const swatches = await Vibrant.from(imageBytes).getPalette();
  return selectPaletteFromSwatches(swatches);
}
