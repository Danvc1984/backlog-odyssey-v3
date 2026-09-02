import type { DataPreference } from "@/lib/visual-preferences";

export type CoverPresentationKind = "image" | "gradient" | "none";

export interface CoverPresentation {
  kind: CoverPresentationKind;
  imageUrl: string | null;
}

export function resolveCoverPresentation({
  title,
  imageUrl,
  resolvedData,
}: {
  title: string;
  imageUrl: string | null;
  resolvedData: DataPreference;
}): CoverPresentation {
  if (title.trim().length === 0) return { kind: "none", imageUrl: null };
  if (resolvedData === "off" && imageUrl) return { kind: "image", imageUrl };
  return { kind: "gradient", imageUrl: null };
}

export function formatFetchedAgo(value: Date | string | null | undefined, now: Date): string {
  if (!value) return "Not fetched";
  const fetchedAt = value instanceof Date ? value : new Date(value);
  const ageMs = now.getTime() - fetchedAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Not fetched";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return "Just now";
  if (ageMs < hour) {
    const minutes = Math.floor(ageMs / minute);
    return `${minutes} min ago`;
  }
  if (ageMs < day) {
    const hours = Math.floor(ageMs / hour);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(ageMs / day);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function formatDescriptionPreview(value: string, maxCharacters = 150): string {
  const normalized = value.replace(/\s+/g, " ").trim().replace(/[.…]+$/, "");
  if (!normalized) return "";

  const clipped = normalized.slice(0, maxCharacters).trimEnd();
  if (clipped.length === normalized.length) return `${clipped}...`;

  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}...`;
}
