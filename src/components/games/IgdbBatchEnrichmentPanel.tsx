"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { startIgdbCatalogEnrichment } from "@/actions/igdb-batch-enrichment";
import { Button } from "@/components/ui/button";
import type { IgdbBatchView } from "@/lib/igdb-batch-runner";

export function IgdbBatchEnrichmentButton({ onStarted }: { onStarted?: (batchId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const result = await startIgdbCatalogEnrichment({});
      if (!result.success) throw new Error(result.error ?? "Failed to queue IGDB catalog enrichment");
      onStarted?.(result.data.batchId);
      toast.success(result.data.kind === "ACTIVE_BATCH" ? "IGDB catalog enrichment is already running." : "IGDB catalog enrichment queued.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to queue IGDB catalog enrichment"); }
    finally { setBusy(false); }
  };
  return <Button type="button" size="sm" disabled={busy} onClick={() => void start()}>{busy ? "Starting..." : "Enrich catalog with IGDB"}</Button>;
}

export function IgdbBatchEnrichmentPanel({ initialBatch, embedded = false, refreshBatchId = null }: { initialBatch: IgdbBatchView | null; embedded?: boolean; refreshBatchId?: string | null }) {
  const [batch, setBatch] = useState(initialBatch);
  const [error, setError] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  const request = useCallback(async (id: string, method: "GET" | "POST") => {
    const response = await fetch(`/api/enrichment/igdb/batches/${encodeURIComponent(id)}`, { method, cache: "no-store" });
    const result = (await response.json()) as { success: boolean; data: IgdbBatchView | null; error: string | null };
    if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Failed to update IGDB catalog enrichment");
    return result.data;
  }, []);
  useEffect(() => {
    if (!refreshBatchId || refreshBatchId === batch?.id) return;
    let cancelled = false;
    void request(refreshBatchId, "GET")
      .then((latest) => { if (!cancelled) setBatch(latest); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load IGDB catalog enrichment"); });
    return () => { cancelled = true; };
  }, [batch?.id, refreshBatchId, request]);
  useEffect(() => {
    if (!batch || batch.status !== "RUNNING") return;
    let cancelled = false;
    let inFlight = false;
    const advance = async () => {
      if (inFlight) return;
      inFlight = true;
      try { const latest = await request(batch.id, lastStatus.current === "RUNNING" ? "POST" : "GET"); if (!cancelled) { lastStatus.current = latest.status; setBatch(latest); } }
      catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to update IGDB catalog enrichment"); }
      finally { inFlight = false; }
    };
    void advance();
    const interval = window.setInterval(() => void advance(), 2000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [batch, request]);

  if (embedded && !batch && !error) return null;
  return <div className="mt-4 space-y-3 text-sm">
    {batch && <><div className="flex items-center justify-between gap-2"><p>{batch.status === "RUNNING" ? "Enriching eligible catalog games with IGDB." : batch.status === "SUCCESS" ? "IGDB enrichment finished successfully." : batch.status === "PARTIAL" ? "IGDB enrichment finished with games to review." : "IGDB enrichment failed. Review failed games below."}</p><span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">{batch.status}</span></div><progress className="h-2 w-full overflow-hidden rounded-full" value={batch.progress} max={100} aria-label="Catalog IGDB enrichment progress" /><p className="text-xs text-muted-foreground">{batch.progress}% complete</p><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5"><span>Total: {batch.counts.total}</span><span>Queued: {batch.counts.queued}</span><span>Running: {batch.counts.running}</span><span>Retrying: {batch.counts.retryWaiting}</span><span>Succeeded: {batch.counts.succeeded}</span><span>Failed: {batch.counts.failed}</span><span>Needs review: {batch.counts.awaitingMatch}</span></div>{batch.pendingAwaitingMatchGames.length > 0 && <FollowUps title="Choose IGDB matches to finish these games" games={batch.pendingAwaitingMatchGames} />}{batch.pendingFailedGames.length > 0 && <FollowUps title="IGDB could not enrich these games" games={batch.pendingFailedGames} />}</>}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>;
}

function FollowUps({ title, games }: { title: string; games: { id: string; name: string }[] }) {
  return <div className="rounded-md border border-border p-3"><p className="font-medium">{title}</p><ul className="mt-2 space-y-1">{games.map((game) => <li key={game.id}><Link href={`/games/${game.id}`} className="text-primary hover:underline">{game.name}</Link></li>)}</ul></div>;
}
