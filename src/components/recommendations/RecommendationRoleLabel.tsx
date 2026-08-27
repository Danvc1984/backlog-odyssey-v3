import type { RecommendationKind, RecommendationRole } from "@/generated/prisma/client";

const ROLE_LABELS: Record<RecommendationRole, string> = {
  BEST_FIT_1: "Best fit",
  BEST_FIT_2: "Best fit",
  OUT_OF_THE_BOX: "Out of the box",
  CHANGE_OF_PACE: "Change of pace",
  DEAL: "Deal",
};

export function recommendationRoleLabel(
  role: RecommendationRole | null | undefined,
  kind: RecommendationKind,
): string | null {
  if (!role) return null;
  if (kind === "PLAY_NEXT" && role === "DEAL") return null;
  if (kind === "BUY" && (role === "OUT_OF_THE_BOX" || role === "CHANGE_OF_PACE")) return null;
  return ROLE_LABELS[role];
}

export function RecommendationRoleLabel({
  role,
  kind,
}: {
  role: RecommendationRole | null | undefined;
  kind: RecommendationKind;
}) {
  const label = recommendationRoleLabel(role, kind);
  if (!label) return null;
  return (
    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}
