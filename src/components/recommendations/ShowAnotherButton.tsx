"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { RecommendationRole } from "@/generated/prisma/client";
import { rotateRecommendationRole } from "@/actions/recommendations";
import {
  RecommendationItemCard,
  type RecommendationCardTarget,
} from "./RecommendationItemCard";

interface ShowAnotherButtonProps {
  runId: string;
  role: RecommendationRole;
  itemId: string;
  target: RecommendationCardTarget;
  name: string;
  rank: number;
  score: number;
  positive: unknown;
  negative: unknown;
  caveats: unknown;
}

interface CardSlot {
  target: RecommendationCardTarget;
  name: string;
  score: number;
  positive: unknown;
  negative: unknown;
  caveats: unknown;
}

export function ShowAnotherButton({
  runId,
  role,
  itemId,
  target,
  name,
  rank,
  score,
  positive,
  negative,
  caveats,
}: ShowAnotherButtonProps) {
  const [pending, setPending] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [slot, setSlot] = useState<CardSlot>({ target, name, score, positive, negative, caveats });

  const rotate = async () => {
    setPending(true);
    const result = await rotateRecommendationRole({ runId, role, itemId });
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to rotate recommendation");
      return;
    }
    if (!result.data?.rotated || !result.data.item) {
      setExhausted(true);
      toast.success("No more suggestions for this role");
      return;
    }
    const rotated = result.data.item;
    setSlot({
      target:
        target.kind === "PLAY_NEXT"
          ? { kind: "PLAY_NEXT", gameId: rotated.gameId ?? "" }
          : { kind: "BUY", wishlistEntryId: rotated.wishlistEntryId ?? "" },
      name: rotated.name,
      score: rotated.score,
      positive: rotated.positive,
      negative: rotated.negative,
      caveats: rotated.caveats,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <RecommendationItemCard
        target={slot.target}
        name={slot.name}
        rank={rank}
        score={slot.score}
        positive={slot.positive}
        negative={slot.negative}
        caveats={slot.caveats}
        runId={runId}
      />
      {!exhausted && (
        <button
          type="button"
          onClick={() => void rotate()}
          disabled={pending}
          className="inline-flex items-center gap-1 self-end rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw aria-hidden className={pending ? "animate-spin" : ""} />
          {pending ? "Rotating..." : "Show another"}
        </button>
      )}
    </div>
  );
}