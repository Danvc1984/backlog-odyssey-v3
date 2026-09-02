"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { updatePrices } from "@/actions/prices";
import { Button } from "@/components/ui/button";
import { formatMexicoTimestamp } from "@/lib/format-times";

export interface PriceRefreshRunSummary {
  id: string;
  status: string;
  counts: unknown;
  requestedAt: string | Date;
  finishedAt: string | Date | null;
}

interface CountBucket {
  total: number;
  refreshed: number;
  notFound: number;
  noOffers: number;
  failed: number;
  identityRequired: number;
  conversionUnavailable?: boolean;
}

function readCounts(value: unknown): CountBucket {
  const fallback = { total: 0, refreshed: 0, notFound: 0, noOffers: 0, failed: 0, identityRequired: 0 };
  if (typeof value !== "object" || value === null) {
    return fallback;
  }
  return { ...fallback, ...(value as Partial<CountBucket>) };
}

export function PriceRefreshPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setRunning(true);
    const result = await updatePrices();
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to refresh prices");
      if (result.data && typeof result.data === "object" && "runId" in result.data) {
        router.refresh();
      }
      return;
    }
    if (result.data) {
      const nextRun = result.data as PriceRefreshRunSummary;
      const nextCounts = readCounts(nextRun.counts);
      const details = [
        `${nextCounts.refreshed} refreshed`,
        `${nextCounts.notFound} not found`,
        `${nextCounts.noOffers} without offers`,
        `${nextCounts.failed} failed`,
        `${nextCounts.identityRequired} need Steam identity`,
        formatMexicoTimestamp(nextRun.finishedAt),
      ].filter((detail): detail is string => Boolean(detail)).join(", ");
      toast.success("Price refresh finished", {
        description: nextCounts.conversionUnavailable
          ? `${details}. Some prices could not be converted to MXN.`
          : details,
      });
    } else {
      toast.success("Price refresh finished");
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" variant="secondary" size="lg" onClick={() => void refresh()} disabled={running}>
        <RefreshCw aria-hidden className={running ? "animate-spin" : ""} />
        {running ? "Refreshing prices..." : "Update prices"}
      </Button>
    </div>
  );
}
