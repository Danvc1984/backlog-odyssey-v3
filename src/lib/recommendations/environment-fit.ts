import type { CompatibilityStatus, Environment } from "@/generated/prisma/client";
import { deriveWindowsFallbackExists, linuxTargetsExist, type OsSetup } from "@/lib/os-setup";
import type { CompatEvidenceInput } from "./types";

export interface EnvironmentCompatibilityRow {
  environment: Environment;
  status: CompatibilityStatus;
}

export type PlayPracticality =
  | { kind: "PLAYABLE"; reason?: { factor: string; label: string } }
  | { kind: "SOFT"; reason: { factor: string; label: string } }
  | { kind: "EXCLUDED"; reason: { factor: string; label: string } };

const SOFT_REASONS: Record<CompatibilityStatus, { factor: string; label: string }> = {
  READY: { factor: "compat_bazzite", label: "Runs well on Linux" },
  READY_WITH_TINKERING: { factor: "compat_tinkering", label: "Needs tinkering on Linux" },
  FALLBACK_RECOMMENDED: { factor: "compat_fallback", label: "Windows fallback recommended" },
  REQUIRED: { factor: "compat_required", label: "Requires Windows to run" },
  UNKNOWN: { factor: "compat_unknown", label: "Compatibility unknown" },
};

const ROM_REASON = { factor: "compat_na", label: "ROM only, compatibility not applicable" };

function windowsDeviceExists(setup: OsSetup): boolean {
  return (
    setup.primaryOs === "WINDOWS" ||
    deriveWindowsFallbackExists(setup) ||
    setup.handheldOs === "WINDOWS"
  );
}

function preferredDeviceExists(setup: OsSetup, preferredEnvironment: Environment): boolean {
  switch (preferredEnvironment) {
    case "LINUX":
      return linuxTargetsExist(setup);
    case "STEAM_DECK":
      return setup.handheldOs === "LINUX";
    case "WINDOWS":
      return windowsDeviceExists(setup);
  }
}

export function compatContributes(setup: Pick<OsSetup, "primaryOs" | "handheldOs">): boolean {
  return linuxTargetsExist(setup);
}

export function resolvePlayEnvStatus(
  setup: OsSetup,
  preferredEnvironment: Environment | null,
  envRows: readonly EnvironmentCompatibilityRow[],
): CompatibilityStatus | null {
  if (!compatContributes(setup)) return null;

  const linuxRow = envRows.find((row) => row.environment === "LINUX");
  if (preferredEnvironment && preferredDeviceExists(setup, preferredEnvironment)) {
    const evidenceEnvironment = preferredEnvironment === "STEAM_DECK" ? "LINUX" : preferredEnvironment;
    return envRows.find((row) => row.environment === evidenceEnvironment)?.status ?? null;
  }
  return linuxRow?.status ?? null;
}

function excludedReason(factor: string, label: string): { factor: string; label: string } {
  return { factor, label };
}

export function classifyPlayPracticality(
  setup: OsSetup,
  evidence: CompatEvidenceInput,
): PlayPracticality {
  if (evidence.romOnly || !compatContributes(setup)) {
    return { kind: "PLAYABLE", reason: evidence.romOnly ? ROM_REASON : undefined };
  }

  const fallbackExists = deriveWindowsFallbackExists(setup);
  const effectiveStatus = evidence.hasSteamIdentity
    ? (evidence.overrideStatus ?? evidence.protonDbStatus ?? "UNKNOWN")
    : "UNKNOWN";
  const blockedByAntiCheat =
    evidence.hasSteamIdentity &&
    evidence.overrideStatus === null &&
    (evidence.awayStatus === "Denied" || evidence.awayStatus === "Broken");

  if (!fallbackExists && blockedByAntiCheat) {
    return {
      kind: "EXCLUDED",
      reason: excludedReason("anticheat", "Anti-cheat blocks Linux, and no Windows fallback is configured"),
    };
  }

  if (!fallbackExists && effectiveStatus === "REQUIRED") {
    return {
      kind: "EXCLUDED",
      reason: excludedReason("compat_required", "Requires Windows to run, but no Windows fallback is configured"),
    };
  }

  if (effectiveStatus === "READY") return { kind: "PLAYABLE" };
  if (blockedByAntiCheat) {
    return {
      kind: "SOFT",
      reason: excludedReason("anticheat", "Anti-cheat blocks Linux"),
    };
  }
  return { kind: "SOFT", reason: SOFT_REASONS[effectiveStatus] };
}
