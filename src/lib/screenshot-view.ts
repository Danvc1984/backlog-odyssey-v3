import type { RawgScreenshotEntry } from "@/lib/rawg-types";

const MAX_SCREENSHOTS = 6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidEntry(value: unknown): value is RawgScreenshotEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (!isFiniteNumber(entry.rawgId)) return false;
  if (typeof entry.image !== "string" || entry.image.length === 0) return false;
  if (entry.width !== null && entry.width !== undefined && !isFiniteNumber(entry.width)) return false;
  if (entry.height !== null && entry.height !== undefined && !isFiniteNumber(entry.height)) return false;
  return true;
}

export function resolvePageScreenshots(payload: unknown): RawgScreenshotEntry[] {
  if (typeof payload !== "object" || payload === null) return [];
  const row = payload as Record<string, unknown>;
  const screenshots = row.screenshots;
  if (!Array.isArray(screenshots)) return [];
  return screenshots.filter(isValidEntry).slice(0, MAX_SCREENSHOTS);
}
