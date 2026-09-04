import { describe, expect, it } from "vitest";

import { selectPaletteFromSwatches } from "./palette";

const swatch = (hex: string) => ({ hex });

describe("selectPaletteFromSwatches", () => {
  it("maps the preferred swatches", () => {
    expect(
      selectPaletteFromSwatches({
        Vibrant: swatch("#111111"),
        DarkVibrant: swatch("#222222"),
        DarkMuted: swatch("#333333"),
        Muted: swatch("#444444"),
        LightMuted: swatch("#555555"),
      }),
    ).toEqual({ primary: "#111111", dark: "#222222", muted: "#444444" });
  });

  it("falls back from vibrant to dark vibrant to the first available swatch", () => {
    expect(selectPaletteFromSwatches({ DarkVibrant: swatch("#222222") })).toEqual({
      primary: "#222222",
      dark: "#222222",
      muted: "#222222",
    });
    expect(selectPaletteFromSwatches({ Muted: swatch("#444444") })).toEqual({
      primary: "#444444",
      dark: "#444444",
      muted: "#444444",
    });
  });

  it("falls back from dark vibrant to dark muted and from muted to light muted", () => {
    expect(
      selectPaletteFromSwatches({
        Vibrant: swatch("#111111"),
        DarkMuted: swatch("#333333"),
        LightMuted: swatch("#555555"),
      }),
    ).toEqual({ primary: "#111111", dark: "#333333", muted: "#555555" });
  });

  it("uses primary for missing dark and muted variants", () => {
    expect(selectPaletteFromSwatches({ Vibrant: swatch("#111111") })).toEqual({
      primary: "#111111",
      dark: "#111111",
      muted: "#111111",
    });
  });

  it("returns null when no swatches are available", () => {
    expect(selectPaletteFromSwatches({})).toBeNull();
  });
});
