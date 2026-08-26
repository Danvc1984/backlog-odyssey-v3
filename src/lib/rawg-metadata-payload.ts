import type { RawgMetadataPayload } from "@/lib/rawg-types";

export function parseRawgMetadataPayload(
  value: unknown,
): RawgMetadataPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const payload = value as Partial<RawgMetadataPayload>;
  return typeof payload.title === "string" && Array.isArray(payload.genres)
    ? (value as RawgMetadataPayload)
    : null;
}
