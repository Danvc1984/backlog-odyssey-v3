"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { advanceIndex, shouldAutoAdvance } from "@/lib/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CarouselFullscreenImage {
  src: string;
  alt: string;
}

interface CarouselProps {
  slides: readonly ReactNode[];
  label: string;
  fullscreenImages?: readonly CarouselFullscreenImage[];
  controlsBelowOnDesktop?: boolean;
}

const AUTO_ADVANCE_MS = 6_000;

export function Carousel({ slides, label, fullscreenImages = [], controlsBelowOnDesktop = false }: CarouselProps) {
  const { resolvedMotion } = useVisualPreferences();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPaused = isHovered || isFocused;

  useEffect(() => {
    if (!shouldAutoAdvance(slides.length, resolvedMotion, isPaused)) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => advanceIndex(index, slides.length, "next"));
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, resolvedMotion, slides.length]);

  const activeIndex = slides.length > 0 ? currentIndex % slides.length : 0;
  const hasControls = slides.length > 1;
  const canFullscreen = fullscreenImages.length === slides.length;
  const move = (direction: "next" | "previous") => {
    setCurrentIndex((index) => advanceIndex(index, slides.length, direction));
  };
  const moveFullscreen = (direction: "next" | "previous") => {
    setFullscreenIndex((index) => advanceIndex(index, fullscreenImages.length, direction));
  };

  useEffect(() => {
    if (!fullscreenOpen || fullscreenImages.length < 1) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? "next" : "previous";
      setFullscreenIndex((index) => advanceIndex(index, fullscreenImages.length, direction));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenImages.length, fullscreenOpen]);

  if (slides.length === 0) return null;

  const fullscreenImage = fullscreenImages[fullscreenIndex];

  return (
    <section
      aria-label={label}
      className={controlsBelowOnDesktop && hasControls ? "lg:relative" : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {canFullscreen ? (
        <button
          type="button"
          className="group relative block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
          onClick={() => {
            setFullscreenIndex(activeIndex);
            setFullscreenOpen(true);
          }}
          aria-label={`View ${fullscreenImages[activeIndex].alt} fullscreen`}
        >
          {slides[activeIndex]}
          <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-primary/90 px-2 py-1 text-center text-xs font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            View fullscreen
          </span>
        </button>
      ) : (
        <div>{slides[activeIndex]}</div>
      )}
      {hasControls ? (
        <div className={controlsBelowOnDesktop ? "mt-3 flex h-5 items-center justify-between gap-3 text-[11px] lg:absolute lg:inset-x-0 lg:top-full lg:mt-3" : "mt-3 flex h-5 items-center justify-between gap-3 text-[11px]"}>
          <button
            type="button"
            className="h-full rounded-md px-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => move("previous")}
            aria-label={`Previous ${label.toLowerCase()} slide`}
          >
            Previous
          </button>
          <span aria-live="polite">
            {activeIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            className="h-full rounded-md px-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => move("next")}
            aria-label={`Next ${label.toLowerCase()} slide`}
          >
            Next
          </button>
        </div>
      ) : null}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="!inset-0 !top-0 !left-0 !h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex !flex-col !rounded-none bg-black/95 p-4 text-white sm:max-w-none md:p-8">
          {fullscreenImage && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-white">{fullscreenImage.alt}</DialogTitle>
                <DialogDescription className="text-white/70">
                  Use the left and right arrow keys to browse.
                </DialogDescription>
              </DialogHeader>
              <div className="relative min-h-0 w-full flex-1">
                <Image
                  src={fullscreenImage.src}
                  alt={fullscreenImage.alt}
                  fill
                  sizes="96vw"
                  className="object-contain"
                  unoptimized
                />
              </div>
              {fullscreenImages.length > 1 && (
                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => moveFullscreen("previous")}>
                    Previous
                  </Button>
                  <span className="text-xs text-white/70">
                    {fullscreenIndex + 1} / {fullscreenImages.length}
                  </span>
                  <Button type="button" variant="outline" onClick={() => moveFullscreen("next")}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
