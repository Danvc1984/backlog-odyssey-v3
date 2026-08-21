"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { updatePrices } from "@/actions/prices";
import { Button } from "@/components/ui/button";

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
}

function readCounts(value: unknown): CountBucket {
  const fallback = { total: 0, refreshed: 0, notFound: 0, noOffers: 0, failed: 0, identityRequired: 0 };
  if (typeof value !== "object" || value === null) {
    return fallback;
  }
  return { ...fallback, ...(value as Partial<CountBucket>) };
}

function formatDate(value: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function PriceRefreshPanel({ initialRun }: { initialRun: PriceRefreshRunSummary | null }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<PriceRefreshRunSummary | null>(initialRun);

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
      setRun(result.data as PriceRefreshRunSummary);
    }
    toast.success("Price refresh finished");
    router.refresh();
  };

  const counts = run ? readCounts(run.counts) : null;
  const finished = formatDate(run?.finishedAt ?? null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={running}>
        <RefreshCw aria-hidden className={running ? "animate-spin" : ""} />
        {running ? "Refreshing prices..." : "Update prices"}
      </Button>
      {counts && (
        <p className="text-xs text-muted-foreground">
          {run?.status === "SUCCESS" ? "" : `${run?.status}: `}
          {counts.refreshed} refreshed
          {counts.notFound > 0 && `, ${counts.notFound} not found`}
          {counts.noOffers > 0 && `, ${counts.noOffers} without offers`}
          {counts.failed > 0 && `, ${counts.failed} failed`}
          {counts.identityRequired > 0 && `, ${counts.identityRequired} need Steam identity`}
          {finished && ` · ${finished}`}
        </p>
      )}
      <a
        href="https://isthereanydeal.com"
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Prices via IsThereAnyDeal
      </a>
    </div>
  );
}
