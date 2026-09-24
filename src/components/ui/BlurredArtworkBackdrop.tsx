"use client";

import Image from "next/image";
import { useState } from "react";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";

export function BlurredArtworkBackdrop({ src }: { src: string | null }) {
  const { resolvedData } = useVisualPreferences();
  const [failed, setFailed] = useState(false);

  if (!src || failed || resolvedData === "on") return null;

  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes="(min-width: 1280px) 33vw, 100vw"
        className="pointer-events-none absolute inset-0 z-0 scale-102 object-cover opacity-75"
        loading="lazy"
        unoptimized
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-white/55 dark:bg-black/45" aria-hidden="true" />
    </>
  );
}
