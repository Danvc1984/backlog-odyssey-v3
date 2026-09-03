"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { dismissRecommendation, rotateRecommendationRole } from "@/actions/recommendations";
import { StartPlayingButton } from "@/components/recommendations/StartPlayingButton";
import { factorChip, caveatChip } from "@/components/recommendations/FactorChips";
import { recommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { recommendationCopy } from "@/lib/recommendations/recommendation-copy";
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
  const [slot, setSlot] = useState<RailSlot>({ itemId, gameId, name, score, positive, negative, caveats: initialCaveats });
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
    setSlot({ itemId: rotated.itemId, gameId: rotatedGameId, name: rotated.name, score: rotated.score, positive: rotated.positive, negative: rotated.negative, caveats: rotated.caveats });
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

  const positiveChips = factors(slot.positive);
  const negativeChips = factors(slot.negative);
  const caveatChips = caveats(slot.caveats);
  const roleLabel = recommendationRoleLabel(role, "PLAY_NEXT");
  const copy = recommendationCopy({
    kind: "PLAY_NEXT",
    role,
    positive: positiveChips,
    caveats: caveatChips,
  });
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <Link href={`/games/${slot.gameId}`} className="block">
        <DetailHeroArt
          id={slot.gameId}
          title={slot.name}
          imageUrl={imageUrl ?? null}
          className="aspect-[16/10]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="technical-label text-muted-foreground">
          {roleLabel ?? "Play next"} / #{String(rank).padStart(2, "0")}
        </p>
      </div>
      {copy && (
        <p
          className="mt-2 overflow-hidden text-sm leading-6 text-muted-foreground"
          style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
        >
          {copy}
        </p>
      )}
      {(positiveChips.length > 0 || negativeChips.length > 0 || caveatChips.length > 0) && (
        <div className="mt-3 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
          {caveatChips.map((chip) => caveatChip(chip))}
          {positiveChips.map((chip) => factorChip(chip, { showPoints: false }))}
          {negativeChips.map((chip) => factorChip(chip, { showPoints: false }))}
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
              <RefreshCw aria-hidden className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
              {pending ? "Rotating..." : "Show another"}
            </button>
          )}
        </div>
        <button type="button" onClick={() => void dismiss()} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <X aria-hidden className="h-3 w-3" />
          Dismiss
        </button>
      </div>
      </div>
    </article>
  );
}
