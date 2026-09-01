"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { dismissRecommendation, rotateRecommendationRole } from "@/actions/recommendations";
import { StartPlayingButton } from "@/components/recommendations/StartPlayingButton";
import { factorChip, caveatChip } from "@/components/recommendations/FactorChips";
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

export function PlayNextRailCard({ runId, role, itemId, gameId, name, rank, score, positive, negative, caveats: initialCaveats }: PlayNextRailCardProps) {
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
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="technical-label text-muted-foreground">Role {role.replaceAll("_", " ")}</p>
          <Link href={`/games/${slot.gameId}`} className="mt-1 block font-medium hover:underline">#{rank} {slot.name}</Link>
        </div>
        <span className="text-xs text-muted-foreground">{slot.score} pts</span>
      </div>
      {(positiveChips.length > 0 || negativeChips.length > 0 || caveatChips.length > 0) && (
        <div className="mt-3 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
          {positiveChips.map((chip) => factorChip(chip))}
          {negativeChips.map((chip) => factorChip(chip))}
          {caveatChips.map((chip) => caveatChip(chip))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <StartPlayingButton gameId={slot.gameId} />
        <button type="button" onClick={() => void dismiss()} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <X aria-hidden className="h-3 w-3" />
          Dismiss
        </button>
      </div>
      {!exhausted && (
        <button type="button" onClick={() => void rotate()} disabled={pending} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">
          <RefreshCw aria-hidden className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {pending ? "Rotating..." : "Show another"}
        </button>
      )}
    </article>
  );
}
