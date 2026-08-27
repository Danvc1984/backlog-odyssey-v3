"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import { dismissRecommendation } from "@/actions/recommendations";
import { Input } from "@/components/ui/input";
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
  runId?: string;
}

export function RecommendationItemCard({
  target,
  name,
  rank,
  score,
  positive,
  negative,
  caveats,
  runId,
}: RecommendationItemCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (dismissed) {
    return null;
  }

  const href = target.kind === "PLAY_NEXT" ? `/games/${target.gameId}` : `/wishlist/${target.wishlistEntryId}`;

  const dismiss = async () => {
    setSubmitting(true);
    const result = await dismissRecommendation(
      target.kind === "PLAY_NEXT"
        ? { gameId: target.gameId, kind: "PLAY_NEXT", runId, reason }
        : { wishlistEntryId: target.wishlistEntryId, kind: "BUY", runId, reason },
    );
    setSubmitting(false);
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
        {reasonOpen ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional reason"
              maxLength={500}
              className="h-8 max-w-xs text-xs"
              aria-label="Dismissal reason"
            />
            <button type="button" onClick={() => void dismiss()} disabled={submitting} className="rounded-md border border-border px-2 py-1 text-xs hover:text-foreground">
              {submitting ? "Saving..." : "Confirm"}
            </button>
            <button type="button" onClick={() => { setReasonOpen(false); setReason(""); }} disabled={submitting} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setReasonOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
            <X aria-hidden className="h-3 w-3" />
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
