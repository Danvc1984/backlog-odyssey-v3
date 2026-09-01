"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { advanceIndex, shouldAutoAdvance } from "@/lib/carousel";

interface CarouselProps {
  slides: readonly ReactNode[];
  label: string;
}

const AUTO_ADVANCE_MS = 8_000;

export function Carousel({ slides, label }: CarouselProps) {
  const { resolvedMotion } = useVisualPreferences();
  const [currentIndex, setCurrentIndex] = useState(0);
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

  if (slides.length === 0) return null;

  const activeIndex = currentIndex % slides.length;
  const hasControls = slides.length > 1;
  const move = (direction: "next" | "previous") => {
    setCurrentIndex((index) => advanceIndex(index, slides.length, direction));
  };

  return (
    <section
      aria-label={label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      <div>{slides[activeIndex]}</div>
      {hasControls ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
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
            onClick={() => move("next")}
            aria-label={`Next ${label.toLowerCase()} slide`}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
