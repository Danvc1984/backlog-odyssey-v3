"use client";

import { useEffect, useState, useTransition } from "react";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";

import { shuffleWallpaper } from "@/actions/wallpaper";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import type { WallpaperSelection } from "@/lib/wallpaper";

interface WallpaperBackgroundProps {
  enabled: boolean;
  selection: WallpaperSelection | null;
}

export function WallpaperBackground({ enabled, selection }: WallpaperBackgroundProps) {
  const { resolvedData } = useVisualPreferences();
  const [isDesktop, setIsDesktop] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [selectionOverride, setSelectionOverride] = useState<WallpaperSelection | null>(null);
  const [isShuffling, startShuffle] = useTransition();
  const activeSelection = selectionOverride ?? selection;
  const imageUrl = activeSelection?.candidate.imageUrl ?? null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  if (!enabled || resolvedData === "on" || !isDesktop || !activeSelection || failedUrl === imageUrl) {
    return null;
  }

  const { candidate } = activeSelection;
  const handleShuffle = () => {
    startShuffle(() => {
      void (async () => {
        const result = await shuffleWallpaper();
        if (!result.success) {
          toast.error(result.error ?? "Failed to shuffle wallpaper");
          return;
        }
        setSelectionOverride(result.data.selection);
        setFailedUrl(null);
      })();
    });
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Wallhaven URLs remain provider evidence, so this intentionally uses a plain img. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.imageUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-55"
          onError={() => setFailedUrl(candidate.imageUrl)}
        />
        <div className="absolute inset-0 bg-background/65" aria-hidden="true" />
      </div>
      <div className="pointer-events-auto fixed right-4 bottom-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-muted-foreground shadow-card backdrop-blur-sm">
        <span className="technical-label truncate">
          {candidate.uploader ? `By ${candidate.uploader}` : "Change Wallpaper"}
        </span>
        <button
          type="button"
          aria-label="Shuffle wallpaper"
          title="Shuffle wallpaper"
          onClick={handleShuffle}
          disabled={isShuffling}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        >
          <Shuffle aria-hidden className={isShuffling ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
        </button>
        <a
          href={candidate.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="technical-label text-signal-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View on Wallhaven
        </a>
      </div>
    </>
  );
}
