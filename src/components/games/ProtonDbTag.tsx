import { cn } from "@/lib/utils";
import {
  PROTONDB_TIER_CLASSES,
  PROTONDB_TIER_LABELS,
  type CompatTag,
  type ProtonDbCardTier,
} from "@/lib/protondb-tags";

type ProtonDbTagProps =
  | { tag: CompatTag }
  | { tier: ProtonDbCardTier };

export function ProtonDbTag(props: ProtonDbTagProps) {
  const tag = "tag" in props ? props.tag : { kind: "evidence" as const, tier: props.tier };
  if (tag === null) return null;

  if (tag.kind === "unknown") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Not checked
      </span>
    );
  }

  const { tier } = tag;
  const label = PROTONDB_TIER_LABELS[tier];
  const isStale = tag.kind === "stale";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        isStale ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : PROTONDB_TIER_CLASSES[tier],
      )}
      aria-label={`ProtonDB tier: ${label}${isStale ? " (stale)" : ""}`}
    >
      {label}
    </span>
  );
}
