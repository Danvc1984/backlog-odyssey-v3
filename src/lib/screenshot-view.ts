import type { IgdbScreenshot } from "@/lib/igdb-types";

const MAX_SCREENSHOTS = 6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidEntry(value: unknown): value is IgdbScreenshot {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.image !== "string" || entry.image.length === 0) return false;
  if (entry.width !== null && entry.width !== undefined && !isFiniteNumber(entry.width)) return false;
  if (entry.height !== null && entry.height !== undefined && !isFiniteNumber(entry.height)) return false;
  return true;
}

export function resolvePageScreenshots(payload: unknown): IgdbScreenshot[] {
  if (typeof payload !== "object" || payload === null) return [];
  const screenshots = (payload as Record<string, unknown>).screenshots;
  return Array.isArray(screenshots)
    ? screenshots.filter(isValidEntry).slice(0, MAX_SCREENSHOTS)
    : [];
}

export const resolveIgdbPageScreenshots = resolvePageScreenshots;
