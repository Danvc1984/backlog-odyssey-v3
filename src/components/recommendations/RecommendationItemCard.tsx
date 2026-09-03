"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import { dismissRecommendation } from "@/actions/recommendations";
import { Input } from "@/components/ui/input";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { caveatChip, factorChip } from "@/components/recommendations/FactorChips";
import { recommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { StartPlayingButton } from "@/components/recommendations/StartPlayingButton";
import { recommendationCopy } from "@/lib/recommendations/recommendation-copy";
import { RefreshCw } from "lucide-react";
import type { RecommendationRole } from "@/generated/prisma/client";
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
  role?: RecommendationRole | null;
  imageUrl?: string | null;
  size?: "large" | "compact";
  rotate?: {
    pending: boolean;
    exhausted: boolean;
    onRotate: () => void;
  };
}

export function RecommendationItemCard({
  target,
  name,
  rank,
  positive,
  negative,
  caveats,
  runId,
  role,
  imageUrl,
  size = "large",
  rotate,
}: RecommendationItemCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (dismissed) {
    return null;
  }

  const href = target.kind === "PLAY_NEXT" ? `/games/${target.gameId}` : `/wishlist/${target.wishlistEntryId}`;
  const roleLabel = role ? recommendationRoleLabel(role, target.kind) : null;
  const rankLabel = roleLabel
    ? `${roleLabel} / #${String(rank).padStart(2, "0")}`
    : `#${rank}`;
  const coverId = target.kind === "PLAY_NEXT" ? target.gameId : target.wishlistEntryId;
  const positives = asFactors(positive);
  const caveatList = asCaveats(caveats);
  const copy = recommendationCopy({
    kind: target.kind,
    role,
    positive: positives,
    caveats: caveatList,
  });

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
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <Link href={href} className="block">
        <DetailHeroArt
          id={coverId}
          title={name}
          imageUrl={imageUrl ?? null}
          className={size === "compact" ? "h-32" : "h-52"}
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="technical-label text-muted-foreground">{rankLabel}</p>
{copy && (
        <p
          className="mt-2 overflow-hidden text-sm leading-6 text-muted-foreground"
          style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
        >
          {copy}
        </p>
      )}
      {(caveatList.length > 0 || positives.length > 0 || asFactors(negative).length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {caveatList.map((caveat) => caveatChip(caveat))}
          {positives.map((factor) => factorChip(factor, { showPoints: false }))}
          {asFactors(negative).map((factor) => factorChip(factor, { showPoints: false }))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {target.kind === "PLAY_NEXT" && <StartPlayingButton gameId={target.gameId} />}
          {rotate && !rotate.exhausted && (
            <button
              type="button"
              onClick={rotate.onRotate}
              disabled={rotate.pending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw aria-hidden className={rotate.pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
              {rotate.pending ? "Rotating..." : "Show another"}
            </button>
          )}
        </div>
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
    </article>
  );
}
