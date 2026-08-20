"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startRawgCatalogEnrichment } from "@/actions/rawg-batch-enrichment";
import { Button } from "@/components/ui/button";
import { activeRawgBatchPollId } from "@/lib/rawg-batch-polling";
import type { RawgBatchView } from "@/lib/rawg-batch-runner";

interface RawgBatchEnrichmentPanelProps {
  initialBatch: RawgBatchView | null;
}

interface BatchEndpointResult {
  success: boolean;
  data: RawgBatchView | null;
  error: string | null;
}

function batchMessage(batch: RawgBatchView): string {
  switch (batch.status) {
    case "RUNNING":
      return "Enriching eligible catalog games with RAWG.";
    case "SUCCESS":
      return "RAWG enrichment finished for every queued game.";
    case "PARTIAL":
      return "RAWG enrichment finished with games that need follow-up.";
    case "FAILED":
      return batch.counts.total === 0
        ? "No catalog games are currently eligible for RAWG enrichment."
        : "RAWG enrichment could not queue any game.";
  }
}

function terminalBatchMessage(batch: RawgBatchView): string {
  switch (batch.status) {
    case "SUCCESS":
      return "RAWG enrichment finished successfully.";
    case "PARTIAL":
      return "RAWG enrichment finished with games needing follow-up.";
    case "FAILED":
      return "RAWG enrichment failed. Review failed games below.";
    case "RUNNING":
      return "";
  }
}

function shouldShowBatch(batch: RawgBatchView): boolean {
  return (
    batch.status === "RUNNING" ||
    batch.pendingAwaitingMatchGames.length > 0 ||
    batch.pendingFailedGames.length > 0
  );
}

export function RawgBatchEnrichmentPanel({
  initialBatch,
}: RawgBatchEnrichmentPanelProps) {
  const router = useRouter();
  const [batch, setBatch] = useState(
    initialBatch && shouldShowBatch(initialBatch) ? initialBatch : null,
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportedTerminalBatchId = useRef<string | null>(null);

  const requestBatch = useCallback(async (batchId: string, method: "GET" | "POST") => {
    const response = await fetch(
      `/api/enrichment/rawg/batches/${encodeURIComponent(batchId)}`,
      { method, cache: "no-store" },
    );
    const result = (await response.json()) as BatchEndpointResult;
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "Failed to load RAWG catalog enrichment");
    }
    return result.data;
  }, []);

  const showBatch = useCallback((latest: RawgBatchView) => {
    setBatch(shouldShowBatch(latest) ? latest : null);
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
    if (latest.isTerminal) {
      router.refresh();
    }
    return latest;
  }, [requestBatch, router, showBatch]);

  const activeBatchId = activeRawgBatchPollId(batch);

  useEffect(() => {
    if (!activeBatchId) return;

    let cancelled = false;
    let inFlight = false;
    const advance = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const latest = await refreshBatch(activeBatchId);
        if (!cancelled && latest.status === "RUNNING") {
          await runBatch(latest.id);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to update RAWG enrichment");
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

  const startBatch = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await startRawgCatalogEnrichment({});
      if (!result.success) {
        throw new Error(result.error ?? "Failed to queue RAWG catalog enrichment");
      }
      if (result.data.kind === "BATCH" && result.data.counts.eligible === 0) {
        if (result.data.counts.skippedActiveWork === 0) {
          toast.info("No games to enrich");
        }
        return;
      }

      const latest = await refreshBatch(result.data.batchId);
      if (latest.status === "RUNNING") {
        await runBatch(latest.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to queue RAWG catalog enrichment");
    } finally {
      setRunning(false);
    }
  };

  if (!batch) {
    return (
      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" disabled={running} onClick={() => void startBatch()}>
          {running ? "Starting..." : "Enrich eligible games"}
        </Button>
        {error && <p className="ml-3 self-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-border p-4" aria-labelledby="rawg-batch-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="rawg-batch-heading" className="text-sm font-medium">
            Catalog RAWG enrichment
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Queue games without RAWG metadata. Existing metadata is never replaced here.
          </p>
        </div>
        {batch.isTerminal && (
          <Button type="button" size="sm" disabled={running} onClick={() => void startBatch()}>
            {running ? "Starting..." : "Enrich eligible games"}
          </Button>
        )}
      </div>

      {batch && (
        <div className="mt-4 space-y-3 text-sm">
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
            aria-label="Catalog RAWG enrichment progress"
          />
          <p className="text-xs text-muted-foreground">{batch.progress}% complete</p>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <span>Queued: {batch.counts.queued}</span>
            <span>Running: {batch.counts.running}</span>
            <span>Retrying: {batch.counts.retryWaiting}</span>
            <span>Matched: {batch.counts.succeeded}</span>
            <span>Failed: {batch.counts.failed}</span>
            <span>Needs review: {batch.counts.awaitingMatch}</span>
          </div>

          {batch.pendingAwaitingMatchGames.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <p className="font-medium">Choose RAWG matches to finish these games</p>
              <ul className="mt-2 space-y-1">
                {batch.pendingAwaitingMatchGames.map((game) => (
                  <li key={game.id}>
                    <Link href={`/games/${game.id}`} className="text-primary hover:underline">
                      {game.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {batch.pendingFailedGames.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="font-medium">RAWG could not enrich these games</p>
              <ul className="mt-2 space-y-1">
                {batch.pendingFailedGames.map((game) => (
                  <li key={game.id}>
                    <Link href={`/games/${game.id}`} className="text-primary hover:underline">
                      {game.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
