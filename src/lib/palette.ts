import { Vibrant } from "node-vibrant/node";
import type { GamePalette } from "./game-theme";

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

export type PaletteSwatches = Partial<Record<PaletteSwatchName, PaletteSwatch | null>>;

const SWATCH_NAMES: PaletteSwatchName[] = [
  "Vibrant",
  "Muted",
  "DarkVibrant",
  "DarkMuted",
  "LightVibrant",
  "LightMuted",
];

function firstHex(swatches: PaletteSwatches, names: PaletteSwatchName[]): string | null {
  for (const name of names) {
    const hex = swatches[name]?.hex;
    if (hex) return hex;
  }
  return null;
}

export function selectPaletteFromSwatches(swatches: PaletteSwatches): GamePalette | null {
  const primary = firstHex(swatches, ["Vibrant", "DarkVibrant", ...SWATCH_NAMES]);
  if (!primary) return null;
  return {
    primary,
    dark: firstHex(swatches, ["DarkVibrant", "DarkMuted"]) ?? primary,
    muted: firstHex(swatches, ["Muted", "LightMuted"]) ?? primary,
  };
}

export async function extractPaletteFromImageBytes(imageBytes: Buffer): Promise<GamePalette | null> {
  const swatches = await Vibrant.from(imageBytes).getPalette();
  return selectPaletteFromSwatches(swatches);
}
