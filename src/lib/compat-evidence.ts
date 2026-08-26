import type { AntiCheatStatus } from "@/lib/compat-fallback";

const AWAY_STATUSES = ["Supported", "Running", "Denied", "Broken", "Planned"] as const;

export interface AntiCheatEvidence {
  status: Exclude<AntiCheatStatus, null>;
  anticheats: string[];
}

function hasValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function parseAntiCheatEvidence(value: unknown): AntiCheatEvidence | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { status?: unknown; anticheats?: unknown };
  if (!hasValue(AWAY_STATUSES, candidate.status)) return null;
  if (
    !Array.isArray(candidate.anticheats) ||
    candidate.anticheats.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  return { status: candidate.status, anticheats: candidate.anticheats };
}
