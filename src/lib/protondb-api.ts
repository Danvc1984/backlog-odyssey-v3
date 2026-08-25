import "server-only";

import type { CompatibilityStatus } from "@/generated/prisma/client";

export const PROTONDB_URL = "https://www.protondb.com/api/v1/reports/summaries";
export const PROTONDB_APP_URL = "https://www.protondb.com/app";

export type ProtonDbProviderError = {
  category: "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
};

export interface ProtonDbResult {
  appId: string;
  confidence: "strong" | "moderate" | "weak" | "insufficient";
  tier: "native" | "platinum" | "gold" | "silver" | "bronze" | "borked";
  status: CompatibilityStatus;
  raw: Record<string, unknown>;
}

type ProtonDbResponse = {
  confidence?: unknown;
  tier?: unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function providerError(
  category: ProtonDbProviderError["category"],
  message: string,
  status?: number,
): ProtonDbProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

function mapStatus(
  confidence: ProtonDbResult["confidence"],
  tier: ProtonDbResult["tier"],
): CompatibilityStatus {
  if (confidence === "insufficient") return "UNKNOWN";
  switch (tier) {
    case "native":
    case "platinum":
    case "gold":
      return "READY";
    case "silver":
      return "READY_WITH_TINKERING";
    case "bronze":
      return "FALLBACK_RECOMMENDED";
    case "borked":
      return "REQUIRED";
  }
}

const CONFIDENCES = new Set<ProtonDbResult["confidence"]>([
  "strong",
  "moderate",
  "weak",
  "insufficient",
]);
const TIERS = new Set<ProtonDbResult["tier"]>([
  "native",
  "platinum",
  "gold",
  "silver",
  "bronze",
  "borked",
]);

export function parseProtonDbSummary(appId: string, payload: unknown): ProtonDbResult | null {
  if (!isRecord(payload)) return null;
  const data = payload as ProtonDbResponse;
  if (!CONFIDENCES.has(data.confidence as ProtonDbResult["confidence"]) ||
      !TIERS.has(data.tier as ProtonDbResult["tier"])) {
    return null;
  }

  const confidence = data.confidence as ProtonDbResult["confidence"];
  const tier = data.tier as ProtonDbResult["tier"];
  return {
    appId,
    confidence,
    tier,
    status: mapStatus(confidence, tier),
    raw: payload,
  };
}

export async function lookupProtonDb(
  appId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProtonDbResult | ProtonDbProviderError | null> {
  let response: Response;
  try {
    response = await fetchFn(`${PROTONDB_URL}/${encodeURIComponent(appId)}.json`, {
      cache: "no-store",
    });
  } catch {
    return providerError("NETWORK", "ProtonDB could not be reached");
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    return providerError("HTTP", "ProtonDB request failed", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return providerError("MALFORMED_RESPONSE", "ProtonDB returned invalid JSON");
  }

  const summary = parseProtonDbSummary(appId, payload);
  if (!summary) {
    return providerError("MALFORMED_RESPONSE", "ProtonDB summary is missing a valid confidence or tier");
  }
  return summary;
}
