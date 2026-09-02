"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  enrichImportedWishlist,
  importSteamWishlist,
  type WishlistImportResult,
} from "@/actions/steam-import-wishlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ENRICHMENT_BATCH_SIZE = 12;

interface EnrichmentProgress {
  completed: number;
  total: number;
}

export function WishlistImportResultPanel({
  result,
  onDismiss,
  enrichmentProgress,
}: {
  result: WishlistImportResult;
  onDismiss: () => void;
  enrichmentProgress: EnrichmentProgress | null;
}) {
  const scrollToReviews = () => {
    document.getElementById("wishlist-import-reviews")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm shadow-card" role="status">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 top-1"
        aria-label="Dismiss wishlist import result"
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
      <p className="technical-label text-warning-text">
        Steam import
      </p>
      <p className="mt-2 pr-7 font-medium">
        {enrichmentProgress ? "Enriching imported games with RAWG" : "Steam wishlist import complete"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {result.created} created, {result.queuedReviews} reviews, {result.ignored} ignored, {result.enrichment.enriched} enriched, {result.enrichment.skipped} skipped
      </p>
      {enrichmentProgress && (
        <p className="mt-1 text-xs text-muted-foreground">
          Enriching {enrichmentProgress.completed} of {enrichmentProgress.total} games...
        </p>
      )}
      {result.queuedReviews > 0 && (
        <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" onClick={scrollToReviews}>
          Review possible matches
        </Button>
      )}
    </div>
  );
}

export function ImportSteamWishlistButton({
  disabled = false,
  onBusyChange,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [result, setResult] = useState<WishlistImportResult | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);

  const importWishlist = async () => {
    setRunning(true);
    try {
      const response = await importSteamWishlist();
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      toast.success("Steam wishlist imported");
      router.refresh();
      setRunning(false);

      if (response.data.enrichmentEntryIds.length > 0) {
        setEnriching(true);
        setEnrichmentProgress({ completed: 0, total: response.data.enrichmentEntryIds.length });
        let enrichment = { enriched: 0, skipped: 0 };
        for (let index = 0; index < response.data.enrichmentEntryIds.length; index += ENRICHMENT_BATCH_SIZE) {
          const batchIds = response.data.enrichmentEntryIds.slice(index, index + ENRICHMENT_BATCH_SIZE);
          const enrichmentResponse = await enrichImportedWishlist(batchIds);
          if (!enrichmentResponse.success) {
            throw new Error(enrichmentResponse.error);
          }
          enrichment = {
            enriched: enrichment.enriched + enrichmentResponse.data.enriched,
            skipped: enrichment.skipped + enrichmentResponse.data.skipped,
          };
          setResult((current) => current ? { ...current, enrichment } : current);
          setEnrichmentProgress({
            completed: Math.min(index + batchIds.length, response.data.enrichmentEntryIds.length),
            total: response.data.enrichmentEntryIds.length,
          });
        }
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import Steam wishlist");
    } finally {
      setEnriching(false);
      setRunning(false);
      setEnrichmentProgress(null);
    }
  };

  const busy = running || enriching;

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  return (
    <div className={cn("flex flex-col items-end gap-2", result && "basis-full")}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void importWishlist()}
        disabled={disabled || busy}
      >
        {busy ? <RefreshCw aria-hidden className="animate-spin" /> : <Download aria-hidden />}
        {enriching
          ? `Enriching ${enrichmentProgress?.completed ?? 0}/${enrichmentProgress?.total ?? 0}...`
          : running ? "Importing wishlist..." : "Import Steam wishlist"}
      </Button>
      {result && (
        <div className="w-full">
          <WishlistImportResultPanel
            result={result}
            onDismiss={() => setResult(null)}
            enrichmentProgress={enrichmentProgress}
          />
        </div>
      )}
    </div>
  );
}
