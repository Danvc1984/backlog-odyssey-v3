"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { importSteamGames } from "@/actions/steam-import";
import { syncSteamPlaytime } from "@/actions/steam-sync";
import { disconnectSteam } from "@/actions/steam";
import { Import, RefreshCw, Unplug } from "lucide-react";

export function SteamConnectionCard({
  connected,
  steamId64,
}: {
  connected: boolean;
  steamId64: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const status = searchParams.get("steam");
    if (status === "connected") {
      toast.success("Steam account linked");
    } else if (status === "error") {
      toast.error("Failed to link Steam account");
    }
    if (status) {
      router.replace("/settings");
    }
  }, [searchParams, router]);

  const handleDisconnect = async () => {
    setSubmitting(true);
    const result = await disconnectSteam();
    setSubmitting(false);

    if (result.success) {
      toast.success("Steam account disconnected");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to disconnect");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const result = await importSteamGames();
    setImporting(false);

    if (result.success) {
      toast.success(
        `Imported ${result.data.imported} new games, updated ${result.data.updated} existing`,
      );
      if (result.data.rawgQueue.status === "DEFERRED") {
        toast.warning("RAWG queue scheduling was deferred. Your Steam import is complete.");
      } else {
        toast.success(
          `RAWG enrichment: queued ${result.data.rawgQueue.queued}, skipped ${result.data.rawgQueue.skipped}`,
        );
      }
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to import Steam games");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncSteamPlaytime();
    setSyncing(false);

    if (result.success) {
      toast.success(`Synced ${result.data.synced} games`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to sync Steam playtime");
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Steam</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {connected
              ? `Linked to SteamID64 ${steamId64}`
              : "Link your Steam account to sync owned games and playtime."}
          </p>
        </div>
        {connected ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || importing || submitting}
            >
              <RefreshCw />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={importing || syncing || submitting}
            >
              <Import />
              {importing ? "Importing..." : "Import from Steam"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={submitting || importing || syncing}
            >
              <Unplug />
              {submitting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Link href="/api/steam/connect">
            <Button size="sm">Connect Steam</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
