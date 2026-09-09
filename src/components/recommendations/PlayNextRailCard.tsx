"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { dismissRecommendation, rotateRecommendationRole } from "@/actions/recommendations";
import { StartPlayingButton } from "@/components/recommendations/StartPlayingButton";
import { factorChip, caveatChip } from "@/components/recommendations/FactorChips";
import { recommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { prepareRecommendationFactors } from "@/lib/recommendations/factor-presentation";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import type { RecommendationRole } from "@/generated/prisma/client";
import type { ExplanationCaveat, ExplanationFactor } from "@/lib/recommendations/types";

interface PlayNextRailCardProps {
  runId: string;
  role: RecommendationRole;
  itemId: string;
  gameId: string;
  name: string;
  rank: number;
  score: number;
  positive: unknown;
  negative: unknown;
  caveats: unknown;
  imageUrl?: string | null;
}

interface RailSlot {
  itemId: string;
  gameId: string;
  name: string;
  imageUrl: string | null | undefined;
  score: number;
  positive: unknown;
  negative: unknown;
  caveats: unknown;
}

function factors(value: unknown): ExplanationFactor[] {
  return Array.isArray(value) ? value.filter((item): item is ExplanationFactor => typeof item === "object" && item !== null && typeof (item as ExplanationFactor).label === "string") : [];
}

function caveats(value: unknown): ExplanationCaveat[] {
  return Array.isArray(value) ? value.filter((item): item is ExplanationCaveat => typeof item === "object" && item !== null && typeof (item as ExplanationCaveat).label === "string") : [];
}

export function PlayNextRailCard({ runId, role, itemId, gameId, name, rank, score, positive, negative, caveats: initialCaveats, imageUrl }: PlayNextRailCardProps) {
  const [slot, setSlot] = useState<RailSlot>({ itemId, gameId, name, imageUrl, score, positive, negative, caveats: initialCaveats });
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  if (dismissed) return null;

  const rotate = async () => {
    if (pending) return;
    setPending(true);
    const result = await rotateRecommendationRole({ runId, role, itemId: slot.itemId });
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to rotate recommendation");
      return;
    }
    if (!result.data?.rotated || !result.data.item?.gameId) {
      setExhausted(true);
      toast.success("No more suggestions for this role");
      return;
    }
    const rotated = result.data.item;
    const rotatedGameId = rotated.gameId;
    if (!rotatedGameId) return;
    setSlot({ itemId: rotated.itemId, gameId: rotatedGameId, name: rotated.name, imageUrl: rotated.imageUrl, score: rotated.score, positive: rotated.positive, negative: rotated.negative, caveats: rotated.caveats });
  };

  const dismiss = async () => {
    if (pending) return;
    setPending(true);
    const result = await dismissRecommendation({ gameId: slot.gameId, kind: "PLAY_NEXT", runId });
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to dismiss recommendation");
      return;
    }
    setDismissed(true);
    toast.success("Dismissed for this run");
  };

  const preparedFactors = prepareRecommendationFactors(factors(slot.positive), factors(slot.negative), caveats(slot.caveats));
  const positiveChips = preparedFactors.positive;
  const negativeChips = preparedFactors.negative;
  const caveatChips = preparedFactors.caveats;
  const roleLabel = recommendationRoleLabel(role, "PLAY_NEXT");
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card">
      <Link href={`/games/${slot.gameId}`} className="block">
        <DetailHeroArt
          id={slot.gameId}
          title={slot.name}
          imageUrl={slot.imageUrl ?? null}
          className="aspect-[16/10]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="technical-label text-muted-foreground">
          {roleLabel ?? "Play next"} / #{String(rank).padStart(2, "0")}
        </p>
      </div>
      {(positiveChips.length > 0 || negativeChips.length > 0 || caveatChips.length > 0) && (
        <div className="mt-3 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
          {positiveChips.map((chip) => factorChip(chip, { showPoints: false }))}
          {negativeChips.map((chip) => factorChip(chip, { showPoints: false }))}
          {caveatChips.map((chip) => caveatChip(chip))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <StartPlayingButton gameId={slot.gameId} />
          {!exhausted && (
            <button
              type="button"
              onClick={() => void rotate()}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              <ArrowClockwiseIcon aria-hidden className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
              {pending ? "Rotating..." : "Show another"}
            </button>
          )}
        </div>
        <button type="button" onClick={() => void dismiss()} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <XIcon aria-hidden className="h-3 w-3" />
          Dismiss
        </button>
      </div>
      </div>
    </article>
  );
}
