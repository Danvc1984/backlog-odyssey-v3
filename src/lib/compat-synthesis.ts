import "server-only";

import type { CompatibilityStatus, Environment } from "@/generated/prisma/client";
import type { AwayResult } from "./away-api";
import { deriveWindowsFallback } from "./compat-fallback";
import type { ProtonDbResult } from "./protondb-api";

export interface CompatibilityRow {
  environment: Environment;
  status: CompatibilityStatus;
  source: string;
}

export interface CompatibilitySynthesisInput {
  protonDb: ProtonDbResult | null;
  away: AwayResult | null;
  game: { name: string; hasSteamAppId: boolean };
}

function protonDbRow(environment: Environment, protonDb: ProtonDbResult | null): CompatibilityRow {
  return {
    environment,
    status: protonDb?.status ?? "UNKNOWN",
    source: protonDb ? "ProtonDB" : "No ProtonDB evidence",
  };
}

export function synthesizeCompatibility(input: CompatibilitySynthesisInput): CompatibilityRow[] {
  const bazzite = protonDbRow("BAZZITE", input.protonDb);
  const windows = deriveWindowsFallback(bazzite.status, input.away?.status ?? null);

  return [
    bazzite,
    { environment: "WINDOWS", status: windows.status, source: windows.source },
  ];
}
