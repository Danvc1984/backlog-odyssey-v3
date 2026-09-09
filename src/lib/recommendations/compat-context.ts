import type { CompatibilityStatus } from "@/generated/prisma/client";
import { deriveWindowsFallbackExists, type OsSetup } from "@/lib/os-setup";
import type { CompatEvidenceInput, ExplanationCaveat, ExplanationFactor } from "./types";

export const COMPAT_STALENESS_DAYS = 180;

const CAVEAT_LABELS = {
  compat_tinkering: "Needs tinkering on Linux",
  compat_fallback: "Windows fallback recommended",
  compat_required: "Requires Windows to run",
  compat_unknown: "Compatibility unknown",
  compat_stale: "Compatibility evidence is stale",
  anticheat: "Anti-cheat blocks Linux",
  compat_na: "ROM only, compatibility not applicable",
} as const;

type NonReadyStatus = Exclude<CompatibilityStatus, "READY">;

const STATUS_CAVEAT_FACTORS: Record<NonReadyStatus, keyof typeof CAVEAT_LABELS> = {
  READY_WITH_TINKERING: "compat_tinkering",
  FALLBACK_RECOMMENDED: "compat_fallback",
  REQUIRED: "compat_required",
  UNKNOWN: "compat_unknown",
};

export interface CompatVerdict {
  positives: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

export function buildCompatContext(
  input: CompatEvidenceInput,
  now: Date,
  setup?: Pick<OsSetup, "primaryOs" | "hasWindowsFallback" | "handheldOs"> | null,
): CompatVerdict {
  if (setup && setup.primaryOs === "WINDOWS" && setup.handheldOs !== "LINUX") {
    return { positives: [], caveats: [] };
  }
  if (input.romOnly) {
    return { positives: [], caveats: [{ factor: "compat_na", label: CAVEAT_LABELS.compat_na }] };
  }

  const positives: ExplanationFactor[] = [];
  const caveats: ExplanationCaveat[] = [];
  const effective = input.hasSteamIdentity
    ? (input.overrideStatus ?? input.protonDbStatus ?? "UNKNOWN")
    : "UNKNOWN";

  if (effective === "READY" && (!setup || setup.primaryOs === "LINUX")) {
    positives.push({ factor: "compat_bazzite", label: "Runs well on your Linux devices", points: 0 });
  } else if (effective !== "READY") {
    caveats.push({
      factor: STATUS_CAVEAT_FACTORS[effective],
      label:
        setup && effective === "FALLBACK_RECOMMENDED" && !deriveWindowsFallbackExists(setup)
          ? "Windows fallback recommended, but none is configured"
          : CAVEAT_LABELS[STATUS_CAVEAT_FACTORS[effective]],
    });
  }

  if (input.hasSteamIdentity) {
    if (input.protonDbFetchedAt) {
      const cutoff =
        now.getTime() - COMPAT_STALENESS_DAYS * 24 * 60 * 60 * 1000;
      if (input.protonDbFetchedAt.getTime() < cutoff) {
        caveats.push({ factor: "compat_stale", label: CAVEAT_LABELS.compat_stale });
      }
    }

    if (input.awayStatus === "Denied" || input.awayStatus === "Broken") {
      caveats.push({ factor: "anticheat", label: CAVEAT_LABELS.anticheat });
    }
  }

  return { positives, caveats };
}
