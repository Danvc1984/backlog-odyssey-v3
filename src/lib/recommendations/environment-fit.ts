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
  READY: { factor: "compat_bazzite", label: "Runs well on your Linux devices" },
  READY_WITH_TINKERING: { factor: "compat_tinkering", label: "Needs tinkering on Linux" },
  FALLBACK_RECOMMENDED: { factor: "compat_fallback", label: "Windows fallback recommended" },
  REQUIRED: { factor: "compat_required", label: "Requires Windows to run" },
  UNKNOWN: { factor: "compat_unknown", label: "Compatibility unknown" },
};

const ROM_REASON = { factor: "compat_na", label: "ROM only, compatibility not applicable" };

function windowsDeviceExists(
  setup: Pick<OsSetup, "primaryOs" | "hasWindowsFallback" | "handheldOs">,
): boolean {
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

export function availableEnvironments(
  setup: Pick<OsSetup, "primaryOs" | "hasWindowsFallback" | "handheldOs">,
): Environment[] {
  const environments: Environment[] = [];
  if (linuxTargetsExist(setup)) environments.push("LINUX");
  if (setup.handheldOs === "LINUX") environments.push("STEAM_DECK");
  if (windowsDeviceExists(setup)) environments.push("WINDOWS");
  return environments;
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

function canUseWindowsHandheldRescue(setup: OsSetup, handheldSuitable: boolean | undefined): boolean {
  return (
    handheldSuitable === true &&
    setup.primaryOs === "LINUX" &&
    setup.handheldOs === "WINDOWS" &&
    !deriveWindowsFallbackExists(setup)
  );
}

export function classifyPlayPracticality(
  setup: OsSetup,
  evidence: CompatEvidenceInput,
  handheldSuitable?: boolean,
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
  const canRescue = canUseWindowsHandheldRescue(setup, handheldSuitable);

  if (setup.primaryOs === "LINUX" && !fallbackExists && blockedByAntiCheat) {
    if (canRescue) {
      return {
        kind: "SOFT",
        reason: excludedReason("handheld_rescue", "Anti-cheat blocks Linux, but your Windows handheld can run it"),
      };
    }
    return {
      kind: "EXCLUDED",
      reason: excludedReason("anticheat", "Anti-cheat blocks Linux, and no Windows fallback is configured"),
    };
  }

  if (setup.primaryOs === "LINUX" && !fallbackExists && effectiveStatus === "REQUIRED") {
    if (canRescue) {
      return {
        kind: "SOFT",
        reason: excludedReason("handheld_rescue", "Needs Windows, but your Windows handheld can run it"),
      };
    }
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

export function formatPlayExclusionReasons(
  exclusions: ReadonlyArray<{ reason?: { label?: string } | null }>,
): string | null {
  const labels = [...new Set(
    exclusions
      .map((exclusion) => exclusion.reason?.label ?? null)
      .filter((label): label is string => label !== null && label.trim() !== ""),
  )];
  return labels.length > 0 ? labels.join("; ") : null;
}
