"use client";

import { useEffect } from "react";

const RING_CLASSES = ["ring-2", "ring-primary/30", "ring-offset-2", "ring-offset-background"];

function focusHashTarget() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (!target) return;

  document.querySelectorAll(".hash-scroll-target").forEach((element) => {
    element.classList.remove("hash-scroll-target", ...RING_CLASSES);
  });
  target.classList.add("hash-scroll-target", ...RING_CLASSES);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function HashScrollTarget() {
  useEffect(() => {
    const frame = requestAnimationFrame(focusHashTarget);
    window.addEventListener("hashchange", focusHashTarget);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", focusHashTarget);
    };
  }, []);

  return null;
}
