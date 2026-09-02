import { cn } from "@/lib/utils";
import {
  PROTONDB_TIER_CLASSES,
  PROTONDB_TIER_LABELS,
  type ProtonDbCardTier,
} from "@/lib/protondb-tags";

export function ProtonDbTag({ tier }: { tier: ProtonDbCardTier }) {
  const label = PROTONDB_TIER_LABELS[tier];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        PROTONDB_TIER_CLASSES[tier],
      )}
      aria-label={`ProtonDB tier: ${label}`}
    >
      {label}
    </span>
  );
}