"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  startWishlistCompatibilitySweep,
  type WishlistCompatSweepRunView,
} from "@/actions/wishlist-compatibility";
import { Button } from "@/components/ui/button";
import { formatMexicoTimestamp } from "@/lib/format-times";

export type { WishlistCompatSweepRunView } from "@/actions/wishlist-compatibility";

interface SweepCountBucket {
  total: number;
  refreshed: number;
  upToDate: number;
  failed: number;
}

function readCounts(value: unknown): SweepCountBucket {
  const fallback = { total: 0, refreshed: 0, upToDate: 0, failed: 0 };
  if (typeof value !== "object" || value === null) {
    return fallback;
  }
  return { ...fallback, ...(value as Partial<SweepCountBucket>) };
}

export function WishlistCompatSweepPanel({
  initialRun,
}: {
  initialRun: WishlistCompatSweepRunView | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<WishlistCompatSweepRunView | null>(initialRun);

  const sweep = async () => {
    setRunning(true);
    toast.info("Compatibility sweep started");
    const result = await startWishlistCompatibilitySweep();
    setRunning(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to run compatibility sweep");
      if (result.data && typeof result.data === "object" && "runId" in result.data) {
        router.refresh();
      }
      return;
    }
    if (result.data) {
      setRun(result.data);
      const counts = readCounts(result.data.counts);
      toast.success("Compatibility sweep finished", {
        description: `${counts.refreshed} refreshed · ${counts.upToDate} up to date · ${counts.failed} failed`,
      });
    }
    router.refresh();
  };

  const counts = run ? readCounts(run.counts) : null;
  const finished = formatMexicoTimestamp(run?.finishedAt ?? null);

  return (
    <div
      className="mt-4 border-t border-border pt-4"
      aria-labelledby="wishlist-compatibility-sweep-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="wishlist-compatibility-sweep-heading"
            className="text-sm font-medium"
          >
            Wishlist games
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Refresh ProtonDB and AWAY evidence for eligible wishlist games.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void sweep()}
          disabled={running}
        >
          <RefreshCw aria-hidden className={running ? "animate-spin" : ""} />
          {running ? "Updating compatibility..." : "Update compatibility"}
        </Button>
      </div>
      {counts && (
        <p className="mt-4 text-xs text-muted-foreground">
          {counts.refreshed} refreshed · {counts.upToDate} up to date · {counts.failed} failed
          {finished && ` · ${finished}`}
        </p>
      )}
    </div>
  );
}
