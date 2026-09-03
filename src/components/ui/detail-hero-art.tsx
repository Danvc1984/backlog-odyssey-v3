"use client";

import { gradientFor } from "@/lib/cover-gradient";
import { resolveDetailArt } from "@/lib/detail-art";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { ArtworkBackdrop } from "@/components/ui/artwork-backdrop";
import { cn } from "@/lib/utils";

export function DetailHeroArt({
  id,
  title,
  imageUrl,
  code,
  hideLabel = false,
  className,
}: {
  id: string;
  title: string;
  imageUrl: string | null;
  code?: string | null;
  hideLabel?: boolean;
  className?: string;
}) {
  const { resolvedData } = useVisualPreferences();
  const presentation = resolveDetailArt({
    metadataImage: imageUrl,
    reducedData: resolvedData === "on",
  });
  const baseClassName = cn("relative w-full overflow-hidden", className);

  if (presentation.kind === "artwork" && presentation.imageUrl) {
    return (
      <div className={cn(baseClassName, "bg-card")}>
        <ArtworkBackdrop src={presentation.imageUrl} />
        <div
          className="absolute inset-0 z-30 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
          aria-hidden="true"
        />
        {!hideLabel && (
          <span className="absolute inset-x-5 bottom-4 z-40 text-base font-bold text-white drop-shadow-sm">
            {title}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn(baseClassName, "bg-gradient-to-br", gradientFor(id))}>
      {code && (
        <span className="technical-label absolute right-5 top-5 text-white/75">{code}</span>
      )}
      <div className="flex h-full w-full items-end p-6">
        {!hideLabel && (
          <span className="text-[clamp(28px,4vw,40px)] font-extrabold uppercase leading-[0.88] tracking-[-0.08em] text-white">
            {title}
          </span>
        )}
      </div>
    </div>
  );
}
