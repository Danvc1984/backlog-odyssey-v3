import type { RecommendationKind, RecommendationRole } from "@/generated/prisma/client";
import type { ExplanationCaveat, ExplanationFactor } from "@/lib/recommendations/types";

const ROLE_OPENERS: Partial<Record<RecommendationRole, string>> = {
  BEST_FIT_1: "A direct best fit for your rotation",
  BEST_FIT_2: "A direct best fit for your rotation",
  OUT_OF_THE_BOX: "A fresh choice outside your usual rotation",
  CHANGE_OF_PACE: "A change of pace when you want a deliberate reset",
  DEAL: "A deal worth acting on now",
};

export function recommendationCopy({
  kind,
  role,
  positive,
  caveats,
}: {
  kind: RecommendationKind;
  role: RecommendationRole | null | undefined;
  positive: readonly ExplanationFactor[];
  caveats: readonly ExplanationCaveat[];
}): string | null {
  const opener =
    (role ? ROLE_OPENERS[role] : undefined) ??
    (kind === "BUY" ? "Recommended for your wallet right now" : "A pick from your backlog");
  const reasons: string[] = [];
  for (const caveat of caveats) {
    if (reasons.length >= 2) break;
    reasons.push(caveat.label);
  }
  for (const factor of positive) {
    if (reasons.length >= 2) break;
    reasons.push(factor.label);
  }
  if (reasons.length === 0) return null;
  return `${opener}: ${reasons.join(" · ")}.`;
}
