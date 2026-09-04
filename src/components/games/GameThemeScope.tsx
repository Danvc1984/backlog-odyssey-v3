"use client";

import type { CSSProperties, ReactNode } from "react";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { paletteToCssVars } from "@/lib/game-theme";
import type { RawgPalette } from "@/lib/rawg-types";

interface GameThemeScopeProps {
  palette: RawgPalette | null;
  children: ReactNode;
}

export function GameThemeScope({ palette, children }: GameThemeScopeProps) {
  const { resolvedData } = useVisualPreferences();
  const style =
    palette && resolvedData === "off"
      ? (paletteToCssVars(palette) as CSSProperties)
      : undefined;

  return (
    <div className={style ? "game-theme-scope" : undefined} style={style}>
      {children}
    </div>
  );
}
