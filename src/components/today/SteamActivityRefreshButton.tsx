"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { refreshSteamActivityNow } from "@/actions/steam-activity";
import { Button } from "@/components/ui/button";

export function SteamActivityRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    const result = await refreshSteamActivityNow();
    setRefreshing(false);
    if (result.state === "NO_CONNECTION") {
      toast.error("Connect Steam before refreshing activity");
      return;
    }
    if (result.state === "STALE_ERROR") {
      toast.error(result.errorMessage ?? "Steam activity could not be refreshed");
    } else {
      toast.success("Steam activity refreshed");
    }
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Refresh Steam activity"
      title="Refresh Steam activity"
      onClick={() => void refresh()}
      disabled={refreshing}
    >
      <ArrowClockwiseIcon aria-hidden className={refreshing ? "animate-spin" : undefined} />
    </Button>
  );
}
