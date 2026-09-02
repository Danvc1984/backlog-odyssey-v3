import "server-only";

import { parseProtonDbSummary, type ProtonDbResult } from "./protondb-api";

export type ProtonDbCardTier = ProtonDbResult["tier"];

export const PROTONDB_TIER_LABELS: Record<ProtonDbCardTier, string> = {
  native: "Native",
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  borked: "Borked",
};

export const PROTONDB_TIER_CLASSES: Record<ProtonDbCardTier, string> = {
  native: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  platinum: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  gold: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  silver: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  bronze: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  borked: "border-red-500/40 bg-red-500/10 text-red-200",
};

export function deriveCardTier(input: {
  steamAppId: string | null;
  isRomOnly: boolean;
  snapshotResult: unknown;
}): ProtonDbCardTier | null {
  if (input.isRomOnly) return null;
  const steamAppId = input.steamAppId?.trim();
  if (!steamAppId) return null;
  return parseProtonDbSummary(steamAppId, input.snapshotResult)?.tier ?? null;
}