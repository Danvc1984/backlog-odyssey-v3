"use client";

import Image from "next/image";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { SectionCard } from "@/components/ui/detail-card";
import { Carousel } from "@/components/ui/Carousel";
import { gradientFor } from "@/lib/cover-gradient";
import { externalUrl } from "@/lib/external-url";
import type { RawgScreenshotEntry } from "@/lib/rawg-types";

function CreditLine({ sourceUrl }: { sourceUrl: string | null }) {
  const href = externalUrl(sourceUrl);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Screenshots via RAWG
      </a>
    );
  }
  return <span className="text-xs text-muted-foreground">Screenshots via RAWG</span>;
}

export function ScreenshotsSection({
  id,
  title,
  screenshots,
  sourceUrl,
}: {
  id: string;
  title: string;
  screenshots: readonly RawgScreenshotEntry[];
  sourceUrl: string | null;
}) {
  const { resolvedData } = useVisualPreferences();
  const reducedData = resolvedData === "on";

  if (screenshots.length === 0) return null;

  const slides = screenshots.map((screenshot, index) => {
    if (reducedData) {
      return (
        <div
          key={String(screenshot.rawgId)}
          aria-hidden="true"
          className={`${gradientFor(`${id}-${index}`)} flex h-24 items-end rounded-lg`}
        >
          <span className="p-3 text-xs font-semibold text-foreground">{title}</span>
        </div>
      );
    }
    return (
      <div key={String(screenshot.rawgId)} className="relative aspect-video overflow-hidden rounded-lg border border-border bg-card">
        <Image
          src={screenshot.image}
          alt={`Screenshot ${index + 1} of ${title}`}
          fill
          sizes="(min-width: 1280px) 33vw, 100vw"
          className="object-contain"
          loading="lazy"
          unoptimized
        />
      </div>
    );
  });

  return (
    <SectionCard eyebrow="Media" title="Screenshots">
      <Carousel label="Screenshots" slides={slides} />
      <CreditLine sourceUrl={sourceUrl} />
    </SectionCard>
  );
}
