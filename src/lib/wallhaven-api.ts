import "server-only";

import { z } from "zod";

import type { WallpaperCandidate } from "./wallpaper";

export const WALLHAVEN_SEARCH_URL = "https://wallhaven.cc/api/v1/search";
export const WALLHAVEN_PAGE_URL = "https://wallhaven.cc/w";
const WALLHAVEN_MAX_CANDIDATES = 20;

export function normalizeWallhavenQuery(keyword: string): string {
  return keyword
    .replace(/[™®©]/gu, "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/gu, " ")
    .trim();
}

export type WallhavenProviderError = {
  category: "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
};

export type WallhavenSearchResult =
  | { ok: true; items: WallpaperCandidate[] }
  | { ok: false; error: WallhavenProviderError };

const wallhavenEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().url(),
  purity: z.literal("sfw"),
  dimension_x: z.number().int().positive(),
  dimension_y: z.number().int().positive(),
  file_type: z.enum(["image/jpeg", "image/png"]),
  uploader: z.string().nullable().optional(),
});

const wallhavenPayloadSchema = z.object({
  data: z.array(z.unknown()),
});

function providerError(
  category: WallhavenProviderError["category"],
  message: string,
  status?: number,
): WallhavenProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

export async function searchWallhaven(
  keyword: string,
  fetchFn: typeof fetch = fetch,
  maxItems = 10,
): Promise<WallhavenSearchResult> {
  const url = new URL(WALLHAVEN_SEARCH_URL);
  url.searchParams.set("q", normalizeWallhavenQuery(keyword));
  url.searchParams.set("categories", "111");
  url.searchParams.set("purity", "100");
  url.searchParams.set("sorting", "random");
  url.searchParams.set("atleast", "1920x1080");

  let response: Response;
  try {
    response = await fetchFn(url.toString(), { cache: "no-store" });
  } catch {
    return {
      ok: false,
      error: providerError("NETWORK", "Wallhaven could not be reached"),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: providerError("HTTP", "Wallhaven request failed", response.status),
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: providerError("MALFORMED_RESPONSE", "Wallhaven returned invalid JSON"),
    };
  }

  const parsedPayload = wallhavenPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      ok: false,
      error: providerError("MALFORMED_RESPONSE", "Wallhaven returned an invalid response"),
    };
  }

  const items = parsedPayload.data.data.flatMap((value) => {
    const entry = wallhavenEntrySchema.safeParse(value);
    return entry.success ? [toWallpaperCandidate(entry.data)] : [];
  });

  const limit = Math.min(WALLHAVEN_MAX_CANDIDATES, Math.max(1, Math.floor(maxItems)));
  return { ok: true, items: items.slice(0, limit) };
}

function toWallpaperCandidate(entry: z.infer<typeof wallhavenEntrySchema>): WallpaperCandidate {
  return {
    id: entry.id,
    pageUrl: `${WALLHAVEN_PAGE_URL}/${encodeURIComponent(entry.id)}`,
    imageUrl: entry.path,
    width: entry.dimension_x,
    height: entry.dimension_y,
    fileType: entry.file_type === "image/png" ? "png" : "jpg",
    uploader: entry.uploader ?? null,
  };
}
