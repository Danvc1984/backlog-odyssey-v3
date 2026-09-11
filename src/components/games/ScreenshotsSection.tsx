"use client";

import Image from "next/image";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { SectionCard } from "@/components/ui/detail-card";
import { Carousel } from "@/components/ui/Carousel";
import { gradientFor } from "@/lib/cover-gradient";
import { externalUrl } from "@/lib/external-url";
import type { IgdbScreenshot } from "@/lib/igdb-types";
import type { RawgScreenshotEntry } from "@/lib/rawg-types";

function CreditLine({ sourceUrl, provider }: { sourceUrl: string | null; provider: "RAWG" | "IGDB" }) {
  const href = externalUrl(sourceUrl);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Artwork and screenshots via {provider}
      </a>
    );
  }
  return <span className="text-xs text-muted-foreground">Artwork and screenshots via {provider}</span>;
}

export function ScreenshotsSection({
  id,
  title,
  screenshots,
  artworkUrls = [],
  conceptArtUrls = [],
  coverUrl = null,
  sourceUrl,
  provider,
}: {
  id: string;
  title: string;
  screenshots: readonly (IgdbScreenshot | RawgScreenshotEntry)[];
  artworkUrls?: readonly string[];
  conceptArtUrls?: readonly string[];
  coverUrl?: string | null;
  sourceUrl: string | null;
  provider?: "RAWG" | "IGDB";
}) {
  const { resolvedData } = useVisualPreferences();
  const reducedData = resolvedData === "on";

  const media = [
    ...(coverUrl ? [{ image: coverUrl, kind: "Key art" }] : []),
    ...artworkUrls.map((image) => ({ image, kind: "Artwork" })),
    ...conceptArtUrls.map((image) => ({ image, kind: "Concept art" })),
    ...screenshots.map((screenshot) => ({ image: screenshot.image, kind: "Screenshot" })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.image === item.image) === index);

  if (media.length === 0) return null;

  const slides = media.map((item, index) => {
    if (reducedData) {
      return (
        <div
          key={`${item.image}-${index}`}
          aria-hidden="true"
          className={`${gradientFor(`${id}-${index}`)} flex h-24 items-end rounded-lg`}
        >
          <span className="p-3 text-xs font-semibold text-foreground">{title}</span>
        </div>
      );
    }
    return (
      <div key={`${item.image}-${index}`} className="relative aspect-video overflow-hidden rounded-lg border border-border bg-card">
        <Image
          src={item.image}
          alt={`${item.kind} ${index + 1} of ${title}`}
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
    <SectionCard eyebrow="Media" title="Artwork and screenshots">
      <Carousel label="Artwork and screenshots" slides={slides} />
      <CreditLine sourceUrl={sourceUrl} provider={provider ?? "RAWG"} />
    </SectionCard>
  );
}
