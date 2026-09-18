"use client";

import { useEffect, useState } from "react";
import { recordRunExposure } from "@/actions/recommendations";
import { RecommendationItemCard, type RecommendationItemCardProps } from "@/components/recommendations/RecommendationItemCard";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { advanceIndex, shouldAutoAdvance } from "@/lib/carousel";

export interface RecommendationSpotlightSlide extends Omit<RecommendationItemCardProps, "onExhausted" | "onReplaced"> {
  itemId: string;
}

export function RecommendationSpotlightCarousel({
  label,
  slides: initialSlides,
}: {
  label: string;
  slides: RecommendationSpotlightSlide[];
}) {
  const { resolvedMotion } = useVisualPreferences();
  const [slides, setSlides] = useState(initialSlides);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeIndex = slides.length === 0 ? 0 : index % slides.length;
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    setSlides(initialSlides);
    setIndex(0);
  }, [initialSlides]);

  useEffect(() => {
    setIndex((current) => slides.length === 0 ? 0 : current % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!activeSlide?.runId) return;
    const target = activeSlide.target.kind === "PLAY_NEXT"
      ? { gameId: activeSlide.target.gameId }
      : { wishlistEntryId: activeSlide.target.wishlistEntryId };
    void recordRunExposure({ runId: activeSlide.runId, items: [{ ...target, role: activeSlide.role ?? undefined }] });
  }, [activeSlide?.itemId, activeSlide?.runId, activeSlide?.role, activeSlide?.target]);

  useEffect(() => {
    if (!shouldAutoAdvance(slides.length, resolvedMotion, paused)) return;
    const timer = window.setInterval(() => setIndex((current) => advanceIndex(current, slides.length, "next")), 10_000);
    return () => window.clearInterval(timer);
  }, [paused, resolvedMotion, slides.length]);

  if (!activeSlide) return null;
  const interact = () => setPaused(true);
  const move = (direction: "next" | "previous") => {
    interact();
    setIndex((current) => advanceIndex(current, slides.length, direction));
  };
  const remove = (itemId: string) => {
    interact();
    setSlides((current) => current.filter((slide) => slide.itemId !== itemId));
  };

  return (
    <section
      aria-label={label}
      onMouseEnter={interact}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={interact}
      onTouchStart={interact}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <RecommendationItemCard key={activeSlide.itemId} {...activeSlide} artClassName="aspect-[5/4] max-h-[32rem]" artLabelClassName="text-2xl font-extrabold md:text-3xl" onExhausted={remove} onReplaced={interact} />
      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <button type="button" onClick={() => move("previous")} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Previous ${label.toLowerCase()} recommendation`}>Previous</button>
          <span aria-live="polite">{activeIndex + 1} / {slides.length}</span>
          <button type="button" onClick={() => move("next")} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Next ${label.toLowerCase()} recommendation`}>Next</button>
        </div>
      )}
    </section>
  );
}
