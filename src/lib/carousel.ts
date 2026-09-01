import type { MotionPreference } from "./visual-preferences";

export type CarouselDirection = "next" | "previous";

export function advanceIndex(
  currentIndex: number,
  slideCount: number,
  direction: CarouselDirection,
): number {
  if (slideCount < 1) return 0;
  const offset = direction === "next" ? 1 : -1;
  return (currentIndex + offset + slideCount) % slideCount;
}

export function shouldAutoAdvance(
  slideCount: number,
  motion: MotionPreference,
  isPaused: boolean,
): boolean {
  return slideCount > 1 && motion === "full" && !isPaused;
}
