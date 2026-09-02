"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { rebuildRecommendationProfileAction } from "@/actions/recommendations";
import { Button } from "@/components/ui/button";

export function RebuildRecommendationProfileButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const rebuild = async () => {
    setRunning(true);
    const result = await rebuildRecommendationProfileAction();
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to rebuild profile");
      return;
    }
    toast.success("Recommendation profile rebuilt");
    router.refresh();
  };

  return <Button type="button" variant="outline" size="sm" onClick={() => void rebuild()} disabled={running}>{running ? "Rebuilding..." : "Rebuild profile"}</Button>;
}
