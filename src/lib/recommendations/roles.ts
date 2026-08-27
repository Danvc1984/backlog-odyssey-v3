import type { CompatibilityStatus, RecommendationRole } from "@/generated/prisma/client";
import type { ExplanationCaveat, RerankMode } from "./types";

export interface PlayRoleCandidate {
  id: string;
  tastePoints: number;
  envStatus: CompatibilityStatus | null;
  genres?: string[];
}

export interface BuyRoleCandidate {
  id: string;
  interest: number | null;
  tastePoints: number;
  isFresh: boolean;
  freshDiscount: number | null;
  isKeyshop: boolean;
}

export interface BuySaturation {
  saturated: boolean;
  fresh80Count: number;
  eligibleCount: number;
}

export interface AssignedRole {
  id: string;
  role: RecommendationRole;
  caveats: ExplanationCaveat[];
}

export interface RoleAssignment {
  assigned: AssignedRole[];
  batches: Record<RecommendationRole, string[]>;
}

const ROLE_FALLBACK_LABELS = {
  noReady: "No ready-to-play candidate left for this role",
  noTaste: "No taste signal yet for a change of pace",
} as const;

function fallbackCaveat(label: string): ExplanationCaveat {
  return { factor: "role_fallback", label };
}

function assignRole(
  assigned: AssignedRole[],
  candidate: PlayRoleCandidate | undefined,
  role: RecommendationRole,
  caveats: ExplanationCaveat[] = [],
): void {
  if (!candidate) return;
  assigned.push({ id: candidate.id, role, caveats });
}

function selectColdStartOrder(
  pool: readonly PlayRoleCandidate[],
): PlayRoleCandidate[] {
  const picked: PlayRoleCandidate[] = [];
  const pickedGenres = new Set<string>();
  const deferred: PlayRoleCandidate[] = [];
  for (const candidate of pool) {
    if (picked.length >= 4) break;
    if ((candidate.genres ?? []).some((genre) => pickedGenres.has(genre))) {
      deferred.push(candidate);
      continue;
    }
    picked.push(candidate);
    for (const genre of candidate.genres ?? []) pickedGenres.add(genre);
  }
  for (const candidate of deferred) {
    if (picked.length >= 4) break;
    picked.push(candidate);
  }
  return picked;
}

export function assignPlayRoles(
  pool: readonly PlayRoleCandidate[],
  mode: RerankMode,
): RoleAssignment {
  const assigned: AssignedRole[] = [];
  const batches: Record<RecommendationRole, string[]> = {
    BEST_FIT_1: [],
    BEST_FIT_2: [],
    OUT_OF_THE_BOX: [],
    CHANGE_OF_PACE: [],
    DEAL: [],
  };

  if (mode === "COLD_START") {
    const displayPool = selectColdStartOrder(pool);
    assignRole(assigned, displayPool[0], "BEST_FIT_1");
    assignRole(assigned, displayPool[1], "BEST_FIT_2");
    const remaining = displayPool.slice(2);
    const ready = remaining.find((candidate) => candidate.envStatus === "READY");
    const outOfTheBox = ready ?? remaining[0];
    assignRole(
      assigned,
      outOfTheBox,
      "OUT_OF_THE_BOX",
      ready ? [] : [fallbackCaveat(ROLE_FALLBACK_LABELS.noReady)],
    );
    assignRole(
      assigned,
      remaining.find((candidate) => candidate.id !== outOfTheBox?.id),
      "CHANGE_OF_PACE",
      [fallbackCaveat(ROLE_FALLBACK_LABELS.noTaste)],
    );
    const displayIds = new Set(displayPool.map((candidate) => candidate.id));
    batches.BEST_FIT_1 = pool.filter((candidate) => !displayIds.has(candidate.id)).map((candidate) => candidate.id);
    batches.BEST_FIT_2 = batches.BEST_FIT_1.slice();
    batches.OUT_OF_THE_BOX = pool
      .filter((candidate) => candidate.envStatus === "READY" && !displayIds.has(candidate.id))
      .map((candidate) => candidate.id);
    batches.CHANGE_OF_PACE = pool
      .filter((candidate) => !displayIds.has(candidate.id))
      .slice()
      .sort((left, right) => left.tastePoints - right.tastePoints)
      .map((candidate) => candidate.id);
    return { assigned, batches };
  }

  const displayIds = new Set<string>();
  assignRole(assigned, pool[0], "BEST_FIT_1");
  assignRole(assigned, pool[1], "BEST_FIT_2");
  for (const candidate of pool.slice(0, 2)) displayIds.add(candidate.id);

  const remaining = pool.filter((candidate) => !displayIds.has(candidate.id));
  const ready = remaining.find((candidate) => candidate.envStatus === "READY");
  const outOfTheBox = ready ?? remaining[0];
  assignRole(
    assigned,
    outOfTheBox,
    "OUT_OF_THE_BOX",
    ready ? [] : [fallbackCaveat(ROLE_FALLBACK_LABELS.noReady)],
  );
  if (outOfTheBox) displayIds.add(outOfTheBox.id);

  const paceCandidates = remaining.filter((candidate) => !displayIds.has(candidate.id));
  const changeOfPace = paceCandidates
    .filter((candidate) => candidate.tastePoints !== 0)
    .slice()
    .sort((left, right) => left.tastePoints - right.tastePoints)[0];
  const pace = changeOfPace ?? paceCandidates[0];
  assignRole(
    assigned,
    pace,
    "CHANGE_OF_PACE",
    changeOfPace ? [] : [fallbackCaveat(ROLE_FALLBACK_LABELS.noTaste)],
  );
  if (pace) displayIds.add(pace.id);

  batches.BEST_FIT_1 = pool.filter((candidate) => !displayIds.has(candidate.id)).map((candidate) => candidate.id);
  batches.BEST_FIT_2 = batches.BEST_FIT_1.slice();
  batches.OUT_OF_THE_BOX = pool
    .filter((candidate) => candidate.envStatus === "READY" && !displayIds.has(candidate.id))
    .map((candidate) => candidate.id);
  batches.CHANGE_OF_PACE = pool
    .filter((candidate) => !displayIds.has(candidate.id))
    .slice()
    .sort((left, right) => left.tastePoints - right.tastePoints)
    .map((candidate) => candidate.id);

  return { assigned, batches };
}

export function resolveBuySaturation(
  candidates: readonly BuyRoleCandidate[],
): BuySaturation {
  const fresh80Count = candidates.filter(
    (candidate) => candidate.isFresh && (candidate.freshDiscount ?? 0) >= 80,
  ).length;
  const eligibleCount = candidates.length;
  const saturated =
    eligibleCount > 0 && fresh80Count >= 3 && fresh80Count / eligibleCount >= 0.2;
  return { saturated, fresh80Count, eligibleCount };
}

function isDealCandidate(candidate: BuyRoleCandidate): boolean {
  const meetsQuality = candidate.isFresh && !candidate.isKeyshop;
  const meetsFit = (candidate.interest ?? 0) >= 2 || candidate.tastePoints > 0;
  return meetsQuality && meetsFit;
}

function compareDeals(left: BuyRoleCandidate, right: BuyRoleCandidate): number {
  return (right.freshDiscount ?? -1) - (left.freshDiscount ?? -1);
}

export function assignBuyRoles(
  pool: readonly BuyRoleCandidate[],
): RoleAssignment & { saturation: BuySaturation } {
  const assigned: AssignedRole[] = [];
  const batches: Record<RecommendationRole, string[]> = {
    BEST_FIT_1: [],
    BEST_FIT_2: [],
    OUT_OF_THE_BOX: [],
    CHANGE_OF_PACE: [],
    DEAL: [],
  };
  const saturation = resolveBuySaturation(pool);
  const displayIds = new Set<string>();
  const add = (candidate: BuyRoleCandidate | undefined, role: RecommendationRole, fallback = false): void => {
    if (!candidate) return;
    assigned.push({
      id: candidate.id,
      role,
      caveats: fallback ? [fallbackCaveat("No offer met the deal floor")] : [],
    });
    displayIds.add(candidate.id);
  };

  add(pool[0], "BEST_FIT_1");
  if (!saturation.saturated) add(pool[1], "BEST_FIT_2");

  const remaining = pool.filter((candidate) => !displayIds.has(candidate.id));
  const dealCandidates = remaining.filter(isDealCandidate).slice().sort(compareDeals);
  const dealCount = saturation.saturated ? 2 : 1;
  for (let index = 0; index < dealCount; index += 1) {
    const deal = dealCandidates[index] ?? remaining[index];
    add(deal, "DEAL", Boolean(deal) && !isDealCandidate(deal));
  }

  batches.BEST_FIT_1 = pool.filter((candidate) => !displayIds.has(candidate.id)).map((candidate) => candidate.id);
  batches.BEST_FIT_2 = batches.BEST_FIT_1.slice();
  batches.DEAL = pool
    .slice()
    .sort(compareDeals)
    .filter((candidate) => !displayIds.has(candidate.id))
    .map((candidate) => candidate.id);
  return { assigned, batches, saturation };
}
