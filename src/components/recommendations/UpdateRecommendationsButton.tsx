"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { updateRecommendations } from "@/actions/recommendations";
import { Button } from "@/components/ui/button";

export function UpdateRecommendationsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const update = async () => {
    setRunning(true);
    const result = await updateRecommendations();
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to update recommendations");
      return;
    }
    const counts = result.data
      ? `${result.data.playNextItems} play next · ${result.data.prunedRuns} runs pruned`
      : undefined;
    toast.success("Recommendations updated", { description: counts });
    router.refresh();
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void update()} disabled={running}>
      <RefreshCw aria-hidden className={running ? "animate-spin" : ""} />
      {running ? "Updating..." : "Update recommendations"}
    </Button>
  );
}
