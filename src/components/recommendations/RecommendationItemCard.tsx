"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { dismissAndReplaceRecommendation } from "@/actions/recommendations";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { caveatChip, factorChip } from "@/components/recommendations/FactorChips";
import { prepareRecommendationFactors } from "@/lib/recommendations/factor-presentation";
import { recommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { StartPlayingButton } from "@/components/recommendations/StartPlayingButton";
import type { RecommendationRole } from "@/generated/prisma/client";
import type { ExplanationCaveat, ExplanationFactor } from "@/lib/recommendations/types";
import { shouldGlowBuyHeading } from "@/lib/deal-glow";
import { cn } from "@/lib/utils";

function asFactors(value: unknown): ExplanationFactor[] {
  return Array.isArray(value)
    ? value.filter((item): item is ExplanationFactor => typeof item === "object" && item !== null && typeof (item as ExplanationFactor).label === "string")
    : [];
}

function asCaveats(value: unknown): ExplanationCaveat[] {
  return Array.isArray(value)
    ? value.filter((item): item is ExplanationCaveat => typeof item === "object" && item !== null && typeof (item as ExplanationCaveat).label === "string")
    : [];
}

export type RecommendationCardTarget =
  | { kind: "PLAY_NEXT"; gameId: string }
  | { kind: "BUY"; wishlistEntryId: string };

export interface RecommendationItemCardProps {
  itemId?: string;
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
  offerDiscount?: number | null;
  artClassName?: string;
  artLabelClassName?: string;
  onExhausted?: (itemId: string) => void;
  onReplaced?: (itemId: string) => void;
}

export function RecommendationItemCard({
  itemId: initialItemId,
  target: initialTarget,
  name: initialName,
  positive: initialPositive,
  negative: initialNegative,
  caveats: initialCaveats,
  runId,
  role,
  imageUrl: initialImageUrl,
  offerDiscount,
  artClassName,
  artLabelClassName,
  onExhausted,
  onReplaced,
}: RecommendationItemCardProps) {
  const [slot, setSlot] = useState({
    itemId: initialItemId,
    target: initialTarget,
    name: initialName,
    imageUrl: initialImageUrl ?? null,
    positive: initialPositive,
    negative: initialNegative,
    caveats: initialCaveats,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReplace = Boolean(runId && role && slot.itemId);
  const href = slot.target.kind === "PLAY_NEXT" ? `/games/${slot.target.gameId}` : `/wishlist/${slot.target.wishlistEntryId}`;
  const roleLabel = role ? recommendationRoleLabel(role, slot.target.kind) : null;
  const coverId = slot.target.kind === "PLAY_NEXT" ? slot.target.gameId : slot.target.wishlistEntryId;
  const prepared = prepareRecommendationFactors(asFactors(slot.positive), asFactors(slot.negative), asCaveats(slot.caveats));
  const chips = [
    ...prepared.positive.map((factor) => ({ key: `positive:${factor.factor}:${factor.label}`, node: factorChip(factor, { showPoints: false }) })),
    ...prepared.negative.map((factor) => ({ key: `negative:${factor.factor}:${factor.label}`, node: factorChip(factor, { showPoints: false }) })),
    ...prepared.caveats.map((caveat) => ({ key: `caveat:${caveat.factor}:${caveat.label}`, node: caveatChip(caveat) })),
  ];
  const visibleChips = chips.slice(0, 4);
  const hiddenChips = chips.slice(4);

  const replace = async () => {
    if (!runId || !role || !slot.itemId || pending) return;
    setPending(true);
    setError(null);
    const result = await dismissAndReplaceRecommendation({ runId, role, itemId: slot.itemId });
    setPending(false);
    if (!result.success || !result.data) {
      const message = result.error ?? "Could not replace this recommendation";
      setError(message);
      toast.error(message);
      return;
    }
    if (!result.data.replacement) {
      onExhausted?.(result.data.dismissedItemId);
      toast.success("We’ll show something else next time.");
      return;
    }
    const replacement = result.data.replacement;
    const target = replacement.gameId
      ? { kind: "PLAY_NEXT" as const, gameId: replacement.gameId }
      : { kind: "BUY" as const, wishlistEntryId: replacement.wishlistEntryId! };
    setSlot({
      itemId: replacement.itemId,
      target,
      name: replacement.name,
      imageUrl: replacement.imageUrl,
      positive: replacement.positive,
      negative: replacement.negative,
      caveats: replacement.caveats,
    });
    onReplaced?.(replacement.itemId);
    toast.success("Here’s another option.");
  };

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card", slot.target.kind === "BUY" && shouldGlowBuyHeading(offerDiscount) && "shadow-glow")}>
      <Link href={href} className="block" aria-label={`View details for ${slot.name}`}>
        <DetailHeroArt id={coverId} title={slot.name} imageUrl={slot.imageUrl} className={artClassName ?? "aspect-[16/10]"} labelClassName={artLabelClassName} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {roleLabel && <p className="technical-label text-muted-foreground">{roleLabel}</p>}
        <h3 className="mt-1 text-lg font-bold"><Link href={href} className="hover:underline">{slot.name}</Link></h3>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleChips.map(({ key, node }) => <span key={key}>{node}</span>)}
            {hiddenChips.length > 0 && (
              <details className="w-full text-xs text-muted-foreground">
                <summary className="cursor-pointer underline underline-offset-4">Show all reasoning ({hiddenChips.length} more)</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">{hiddenChips.map(({ key, node }) => <span key={key}>{node}</span>)}</div>
              </details>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Link href={href} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">View details</Link>
          {slot.target.kind === "PLAY_NEXT" && <StartPlayingButton gameId={slot.target.gameId} />}
          {canReplace && (
            <button type="button" onClick={() => void replace()} disabled={pending} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">
              <ArrowClockwiseIcon aria-hidden className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
              {pending ? "Finding another..." : "Show me another option"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
