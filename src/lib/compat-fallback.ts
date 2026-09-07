export type CompatibilityStatus =
  | "READY"
  | "READY_WITH_TINKERING"
  | "FALLBACK_RECOMMENDED"
  | "REQUIRED"
  | "UNKNOWN";

export type AntiCheatStatus = "Supported" | "Running" | "Denied" | "Broken" | "Planned" | null;

export interface WindowsFallback {
  status: CompatibilityStatus;
  label: "Fallback not needed" | "Fallback recommended" | "Fallback required";
  source: string;
}

export function deriveWindowsFallback(
  linuxStatus: CompatibilityStatus,
  antiCheatStatus: AntiCheatStatus,
): WindowsFallback {
  if (antiCheatStatus === "Denied" || antiCheatStatus === "Broken") {
    return {
      status: "REQUIRED",
      label: "Fallback required",
      source: `Windows fallback is required because AWAY reports Linux anti-cheat as ${antiCheatStatus}.`,
    };
  }

  switch (linuxStatus) {
    case "READY":
      return {
        status: "READY",
        label: "Fallback not needed",
        source: "Windows fallback is not needed because ProtonDB reports Linux ready without tinkering.",
      };
    case "READY_WITH_TINKERING":
      return {
        status: "FALLBACK_RECOMMENDED",
        label: "Fallback recommended",
        source: "Windows fallback is recommended because Linux needs tinkering according to ProtonDB.",
      };
    case "FALLBACK_RECOMMENDED":
      return {
        status: "FALLBACK_RECOMMENDED",
        label: "Fallback recommended",
        source: "Windows fallback is recommended because ProtonDB reports degraded Linux compatibility.",
      };
    case "REQUIRED":
      return {
        status: "REQUIRED",
        label: "Fallback required",
        source: "Windows fallback is required because ProtonDB reports Linux as not playable.",
      };
    case "UNKNOWN":
      return {
        status: "REQUIRED",
        label: "Fallback required",
        source: "Windows fallback is required because Linux compatibility is unknown.",
      };
  }
}
