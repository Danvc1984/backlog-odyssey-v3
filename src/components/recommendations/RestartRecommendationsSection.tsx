"use client";

import { useState } from "react";
import { toast } from "sonner";
import { restartRecommendations } from "@/actions/recommendations";
import { Button } from "@/components/ui/button";

export function RestartRecommendationsSection() {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const restart = async () => {
    setRunning(true);
    const result = await restartRecommendations();
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to restart recommendations");
      return;
    }
    setConfirming(false);
    toast.success("Recommendations restarted", {
      description: `${result.data.recommendationRun} runs, ${result.data.recommendationEvent} events, and ${result.data.recommendationFeedback} dismissals removed.`,
    });
  };

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recommendations</h2>
      <p className="mt-2 text-sm text-muted-foreground">Remove recommendation runs, dismissals, and event history. Your games, wishlist, offers, and provider data stay unchanged.</p>
      {confirming ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="destructive" onClick={() => void restart()} disabled={running}>{running ? "Restarting..." : "Confirm restart"}</Button>
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={running}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setConfirming(true)}>Restart recommendations</Button>
      )}
    </section>
  );
}
