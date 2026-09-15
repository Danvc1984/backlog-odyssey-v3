"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { updateRecommendations } from "@/actions/recommendations";
import { tuneContextSchema, type TuneContext } from "@/lib/recommendations/types";
import { Button } from "@/components/ui/button";

const TUNE_STORAGE_PREFIX = "backlog-odyssey:tune:";

function storedTune(engine: "PLAY_NEXT" | "BUY"): TuneContext | null {
  try {
    const raw = sessionStorage.getItem(`${TUNE_STORAGE_PREFIX}${engine}`);
    if (!raw) return null;
    const parsed = tuneContextSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function UpdateRecommendationsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const update = async () => {
    setRunning(true);
    const result = await updateRecommendations({ playTune: storedTune("PLAY_NEXT"), buyTune: storedTune("BUY") });
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to update recommendations");
      return;
    }
    const counts = result.data ? `${result.data.playNextItems} play next · ${result.data.prunedRuns} runs pruned` : undefined;
    toast.success("Recommendations updated", { description: counts });
    router.refresh();
  };

  return <Button type="button" variant="secondary" size="lg" onClick={() => void update()} disabled={running}><ArrowClockwiseIcon aria-hidden className={running ? "animate-spin" : ""} />{running ? "Updating..." : "Update recommendations"}</Button>;
}
