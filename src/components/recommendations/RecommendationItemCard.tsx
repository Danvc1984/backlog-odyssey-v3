"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import { dismissRecommendation } from "@/actions/recommendations";
import { caveatChip, factorChip } from "@/components/recommendations/FactorChips";
import type { ExplanationCaveat, ExplanationFactor } from "@/lib/recommendations/types";

function asFactors(value: unknown): ExplanationFactor[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ExplanationFactor =>
      typeof item === "object" && item !== null && typeof (item as ExplanationFactor).label === "string",
  );
}

function asCaveats(value: unknown): ExplanationCaveat[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ExplanationCaveat =>
      typeof item === "object" && item !== null && typeof (item as ExplanationCaveat).label === "string",
  );
}

export type RecommendationCardTarget =
  | { kind: "PLAY_NEXT"; gameId: string }
  | { kind: "BUY"; wishlistEntryId: string };

export interface RecommendationItemCardProps {
  target: RecommendationCardTarget;
  name: string;
  rank: number;
  score: number;
  positive: unknown;
  negative: unknown;
  caveats: unknown;
}

export function RecommendationItemCard({
  target,
  name,
  rank,
  score,
  positive,
  negative,
  caveats,
}: RecommendationItemCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const href = target.kind === "PLAY_NEXT" ? `/games/${target.gameId}` : `/wishlist/${target.wishlistEntryId}`;

  const dismiss = async () => {
    const result = await dismissRecommendation(
      target.kind === "PLAY_NEXT"
        ? { gameId: target.gameId, kind: "PLAY_NEXT" }
        : { wishlistEntryId: target.wishlistEntryId, kind: "BUY" },
    );
    if (!result.success) {
      toast.error(result.error ?? "Failed to dismiss recommendation");
      return;
    }
    setDismissed(true);
    toast.success("Dismissed for this run");
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={href} className="text-base font-medium hover:underline">
          #{rank} {name}
        </Link>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">{score} pts</span>
      </div>
      {(asFactors(positive).length > 0 || asFactors(negative).length > 0 || asCaveats(caveats).length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {asFactors(positive).map((factor) => factorChip(factor))}
          {asFactors(negative).map((factor) => factorChip(factor))}
          {asCaveats(caveats).map((caveat) => caveatChip(caveat))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void dismiss()}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="h-3 w-3" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
