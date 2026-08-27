"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { startPlayingFromRecommendation } from "@/actions/recommendations";

interface StartPlayingButtonProps {
  gameId: string;
}

export function StartPlayingButton({ gameId }: StartPlayingButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [inProgressGame, setInProgressGame] = useState<string | null>(null);

  const start = async (makeMain?: boolean) => {
    if (pending) return;
    setPending(true);
    const result = await startPlayingFromRecommendation({ gameId, makeMain });
    setPending(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Failed to start playing");
      return;
    }
    if (result.data.needsMainDecision) {
      setInProgressGame(result.data.inProgressGame);
      setDecisionOpen(true);
      return;
    }
    setDecisionOpen(false);
    toast.success("Started playing");
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-2">
      {decisionOpen ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {inProgressGame ? `Playing ${inProgressGame} right now.` : "Another game is in progress."}
          </span>
          <button
            type="button"
            onClick={() => void start(false)}
            disabled={pending}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            {pending ? "Starting..." : "Start playing"}
          </button>
          <button
            type="button"
            onClick={() => void start(true)}
            disabled={pending}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            {pending ? "Starting..." : "Make main game"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Play aria-hidden className="h-3 w-3" />
          {pending ? "Starting..." : "Start playing"}
        </button>
      )}
    </div>
  );
}