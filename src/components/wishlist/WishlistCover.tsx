"use client";

import Image from "next/image";
import Link from "next/link";
import { gradientFor } from "@/lib/cover-gradient";
import { resolveCoverPresentation } from "@/lib/cover-presentation";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { cn } from "@/lib/utils";

export function WishlistCover({
  id,
  title,
  imageUrl,
  href,
  className,
  showTitle = true,
}: {
  id: string;
  title: string;
  imageUrl: string | null;
  href?: string;
  className?: string;
  showTitle?: boolean;
}) {
  const { resolvedData } = useVisualPreferences();
  const presentation = resolveCoverPresentation({ title, imageUrl, resolvedData });
  const destination = href ?? `/wishlist/${id}`;
  const baseClassName = cn(
    "relative w-full overflow-hidden bg-gradient-to-br",
    className ?? "h-40",
  );

  if (presentation.kind === "none") return <div className={cn(baseClassName, "bg-muted")} aria-hidden="true" />;

  return (
    <div className={cn(baseClassName, presentation.kind === "image" ? "bg-card" : gradientFor(id))}>
      {presentation.kind === "image" && presentation.imageUrl ? (
        <Image
          src={presentation.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1280px) 33vw, 100vw"
          className="object-cover"
          loading="lazy"
          unoptimized
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-lg font-semibold text-foreground">
          {showTitle && (
            <Link href={destination} className="hover:underline focus-visible:underline">
              {title}
            </Link>
          )}
        </div>
      )}
      {presentation.kind === "image" && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true" />}
      {presentation.kind === "image" && showTitle && (
        <Link
          href={destination}
          className="absolute inset-x-4 bottom-3 text-sm font-semibold text-white drop-shadow-sm hover:underline focus-visible:underline"
        >
          {title}
        </Link>
      )}
    </div>
  );
}
