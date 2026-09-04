import { describe, expect, it } from "vitest";
import { paletteToCssVars, resolvePagePalette } from "./game-theme";

const palette = {
  primary: "#12abef",
  dark: "#123456",
  muted: "#abcdef",
} as const;

describe("resolvePagePalette", () => {
  it("returns a complete v3 palette", () => {
    expect(resolvePagePalette({ schemaVersion: 3, palette })).toEqual(palette);
  });

  it("returns null for a v2-shaped row without a palette", () => {
    expect(resolvePagePalette({ schemaVersion: 2, title: "Portal" })).toBeNull();
  });

  it("returns null for a malformed palette", () => {
    expect(resolvePagePalette({ palette: { ...palette, muted: undefined } })).toBeNull();
    expect(resolvePagePalette({ palette: { ...palette, dark: "blue" } })).toBeNull();
  });
});

describe("paletteToCssVars", () => {
  it("emits the exact game theme variable names", () => {
    expect(paletteToCssVars(palette)).toEqual({
      "--game-accent": "#12abef",
      "--game-accent-dark": "#123456",
      "--game-accent-muted": "#abcdef",
    });
  });
});
