"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { enrichWishlistEntries } from "@/actions/wishlist-igdb";
import { Button } from "@/components/ui/button";

const BATCH_SIZE = 12;

export function WishlistIgdbBatchEnrichmentButton({
  entryIds,
  size = "lg",
  variant = "secondary",
}: {
  entryIds: string[];
  size?: "sm" | "lg";
  variant?: "outline" | "secondary";
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);

  if (entryIds.length === 0) return null;

  const enrich = async () => {
    setRunning(true);
    setCompleted(0);
    let enriched = 0;
    let skipped = 0;

    try {
      for (let index = 0; index < entryIds.length; index += BATCH_SIZE) {
        const result = await enrichWishlistEntries({
          wishlistEntryIds: entryIds.slice(index, index + BATCH_SIZE),
        });
        if (!result.success) throw new Error(result.error ?? "Failed to enrich wishlist with IGDB");
        enriched += result.data.enriched;
        skipped += result.data.skipped;
        setCompleted(Math.min(index + BATCH_SIZE, entryIds.length));
      }
      toast.success("Wishlist IGDB enrichment finished", {
        description: `${enriched} enriched, ${skipped} needing review or unavailable.`,
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enrich wishlist with IGDB");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={() => void enrich()} disabled={running}>
      <ArrowClockwiseIcon aria-hidden className={running ? "animate-spin" : undefined} />
      {running ? `Enriching wishlist ${completed}/${entryIds.length}...` : "Enrich wishlist with IGDB"}
    </Button>
  );
}
