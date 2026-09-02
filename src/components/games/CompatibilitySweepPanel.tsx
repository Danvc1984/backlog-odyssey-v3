"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { startCompatibilitySweep } from "@/actions/compat-batch-enrichment";
import { Button } from "@/components/ui/button";
import type { CompatBatchView } from "@/lib/compat-batch-runner";
import {
  WishlistCompatSweepPanel,
  type WishlistCompatSweepRunView,
} from "@/components/wishlist/WishlistCompatSweepPanel";
import {
  RawgBatchEnrichmentButton,
  RawgBatchEnrichmentPanel,
} from "@/components/games/RawgBatchEnrichmentPanel";
import type { RawgBatchView } from "@/lib/rawg-batch-runner";

interface CompatibilitySweepPanelProps {
  initialBatch: CompatBatchView | null;
  initialRawgBatch: RawgBatchView | null;
  initialWishlistRun: WishlistCompatSweepRunView | null;
}

interface BatchEndpointResult {
  success: boolean;
  data: CompatBatchView | null;
  error: string | null;
}

function batchMessage(batch: CompatBatchView): string {
  switch (batch.status) {
    case "RUNNING":
      return "Refreshing compatibility evidence for eligible catalog games.";
    case "SUCCESS":
      return "Compatibility refresh finished for every queued game.";
    case "PARTIAL":
      return "Compatibility refresh finished with failed games to review.";
    case "FAILED":
      return batch.counts.total === 0
        ? "No catalog games are currently eligible for compatibility refresh."
        : "Compatibility refresh could not complete successfully.";
  }
}

function terminalBatchMessage(batch: CompatBatchView): string {
  switch (batch.status) {
    case "SUCCESS":
      return "Compatibility refresh finished successfully.";
    case "PARTIAL":
      return "Compatibility refresh finished with failed games to review.";
    case "FAILED":
      return "Compatibility refresh failed. Review the failed games below.";
    case "RUNNING":
      return "";
  }
}

export function CompatibilitySweepPanel({
  initialBatch,
  initialRawgBatch,
  initialWishlistRun,
}: CompatibilitySweepPanelProps) {
  const router = useRouter();
  const [batch, setBatch] = useState<CompatBatchView | null>(initialBatch);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedGameIds, setDismissedGameIds] = useState<Set<string>>(new Set());
  const reportedTerminalBatchId = useRef<string | null>(null);

  const requestBatch = useCallback(async (batchId: string, method: "GET" | "POST") => {
    const response = await fetch(
      `/api/enrichment/compat/batches/${encodeURIComponent(batchId)}`,
      { method, cache: "no-store" },
    );
    const result = (await response.json()) as BatchEndpointResult;
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "Failed to load compatibility sweep");
    }
    return result.data;
  }, []);

  const showBatch = useCallback((latest: CompatBatchView) => {
    setBatch(latest);
    if (latest.isTerminal && reportedTerminalBatchId.current !== latest.id) {
      reportedTerminalBatchId.current = latest.id;
      const message = terminalBatchMessage(latest);
      if (latest.status === "SUCCESS") {
        toast.success(message);
      } else if (latest.status === "PARTIAL") {
        toast.warning(message);
      } else {
        toast.error(message);
      }
    }
  }, []);

  const refreshBatch = useCallback(async (batchId: string) => {
    const latest = await requestBatch(batchId, "GET");
    showBatch(latest);
    return latest;
  }, [requestBatch, showBatch]);

  const runBatch = useCallback(async (batchId: string) => {
    const latest = await requestBatch(batchId, "POST");
    showBatch(latest);
    if (latest.isTerminal) router.refresh();
    return latest;
  }, [requestBatch, router, showBatch]);

  const activeBatchId = batch?.status === "RUNNING" ? batch.id : null;

  useEffect(() => {
    if (!activeBatchId) return;

    let cancelled = false;
    let inFlight = false;
    const advance = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const latest = await refreshBatch(activeBatchId);
        if (!cancelled && latest.status === "RUNNING") await runBatch(latest.id);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to update compatibility sweep");
        }
      } finally {
        inFlight = false;
      }
    };

    void advance();
    const interval = window.setInterval(() => void advance(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeBatchId, refreshBatch, runBatch]);

  const startSweep = async () => {
    setRunning(true);
    setError(null);
    setDismissedGameIds(new Set());
    try {
      const result = await startCompatibilitySweep({});
      if (!result.success) throw new Error(result.error ?? "Failed to queue compatibility sweep");

      if (result.data.kind === "NO_ELIGIBLE") {
        setBatch(null);
        toast.info("Compatibility sweep is not available until you add games to your library.");
        return;
      }

      const latest = await refreshBatch(result.data.batchId);
      if (latest.status === "RUNNING") await runBatch(latest.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to queue compatibility sweep");
    } finally {
      setRunning(false);
    }
  };

  const visibleFailedGames = batch?.failedGames.filter(
    (game) => !dismissedGameIds.has(game.id),
  ) ?? [];

  return (
    <section className="mt-6 rounded-lg border border-border p-4" aria-labelledby="compatibility-sweep-heading">
      <div className="border-b border-border pb-3">
        <div>
          <h2
            id="compatibility-sweep-heading"
            className="text-sm font-medium uppercase tracking-wider text-muted-foreground"
          >
            Enrichment and compatibility
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enrich RAWG metadata and refresh ProtonDB and AWAY evidence by library domain.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Catalog games</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Refresh eligible games in your library.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RawgBatchEnrichmentButton />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running || activeBatchId !== null}
              onClick={() => void startSweep()}
            >
              {running ? "Starting..." : activeBatchId ? "Sweep running..." : "Sweep compatibility"}
            </Button>
          </div>
        </div>

        <RawgBatchEnrichmentPanel initialBatch={initialRawgBatch} embedded />

        {batch && (
          <div className="mt-4 space-y-3 text-sm">
            <h4 className="text-sm font-medium">Compatibility sweep</h4>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>{batchMessage(batch)}</p>
              <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                {batch.status}
              </span>
            </div>
            <progress
              className="h-2 w-full overflow-hidden rounded-full"
              value={batch.progress}
              max={100}
              aria-label="Compatibility sweep progress"
            />
            <p className="text-xs text-muted-foreground">{batch.progress}% complete</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
              <span>Total: {batch.counts.total}</span>
              <span>Queued: {batch.counts.queued}</span>
              <span>Running: {batch.counts.running}</span>
              <span>Retrying: {batch.counts.retryWaiting}</span>
              <span>Succeeded: {batch.counts.succeeded}</span>
              <span>Failed: {batch.counts.failed}</span>
            </div>

            {visibleFailedGames.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="font-medium">Compatibility refresh failed for these games</p>
                <ul className="mt-2 space-y-1">
                  {visibleFailedGames.map((game) => (
                    <li key={game.id} className="flex items-center justify-between gap-2">
                      <Link href={`/games/${game.id}`} className="text-primary hover:underline">
                        {game.name}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Dismiss ${game.name} from failed games`}
                        onClick={() => setDismissedGameIds((current) => new Set(current).add(game.id))}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <WishlistCompatSweepPanel initialRun={initialWishlistRun} />
    </section>
  );
}
