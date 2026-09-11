"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshWishlistIgdbMetadata } from "@/actions/wishlist-igdb";
import { Button } from "@/components/ui/button";

export function WishlistIgdbEnrichmentControl({ wishlistEntryId, hasSnapshot }: { wishlistEntryId: string; hasSnapshot: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const load = async (confirm = false) => {
    setLoading(true);
    const result = await refreshWishlistIgdbMetadata({ wishlistEntryId, confirmOverwrite: confirm });
    setLoading(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Failed to load IGDB metadata");
      return;
    }
    if ("kind" in result.data) {
      if (result.data.kind === "OVERWRITE_REQUIRED") setConfirmOverwrite(true);
      return;
    }
    setConfirmOverwrite(false);
    toast.success(`IGDB metadata ${hasSnapshot ? "refreshed" : "loaded"}`);
    if (result.data.steamAppIdApplied) toast.success(`Steam App ${result.data.steamAppIdApplied} applied from IGDB`);
    if (result.data.steamAppIdConflict) toast.warning(result.data.steamAppIdConflict);
    router.refresh();
  };

  return confirmOverwrite ? (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning-border bg-warning/10 p-3">
      <p className="text-xs text-warning-text">Replace the existing IGDB metadata?</p>
      <Button type="button" size="sm" onClick={() => void load(true)} disabled={loading}>{loading ? "Refreshing..." : "Confirm refresh"}</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOverwrite(false)} disabled={loading}>Cancel</Button>
    </div>
  ) : (
    <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void load()}>
      {loading ? (hasSnapshot ? "Refreshing..." : "Loading...") : (hasSnapshot ? "Refresh metadata" : "Load IGDB metadata")}
    </Button>
  );
}
