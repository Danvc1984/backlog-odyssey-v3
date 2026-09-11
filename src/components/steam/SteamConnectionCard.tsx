"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImportSteamWishlistButton } from "@/components/wishlist/ImportSteamWishlistButton";
import { importSteamGames } from "@/actions/steam-import";
import { syncSteamPlaytime } from "@/actions/steam-sync";
import { disconnectSteam } from "@/actions/steam";
import { FileArrowDownIcon, ArrowClockwiseIcon, PlugsConnectedIcon } from "@phosphor-icons/react";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { SourceIcon } from "@/components/sources/SourceIcon";

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
  const [importingWishlist, setImportingWishlist] = useState(false);

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
      if (result.data.igdbQueue.status === "DEFERRED") {
        toast.warning("IGDB queue scheduling was deferred. Your Steam import is complete.");
      } else {
        toast.success(
          `IGDB enrichment: queued ${result.data.igdbQueue.queued}, skipped ${result.data.igdbQueue.skipped}`,
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
    <SectionCard
      eyebrow="Account"
      title="Steam connection"
      id="steam-connection-card"
      description={connected
        ? `Linked to SteamID64 ${steamId64}`
        : "Link your Steam account to sync owned games and playtime."}
      status={<StatusPill tone={connected ? "ok" : "warning"}>{connected ? "Connected" : "Not connected"}</StatusPill>}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Steam actions stay explicit and never run automatically.
          </p>
        </div>
        {connected ? (
          <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || importing || submitting || importingWishlist}
            >
              <ArrowClockwiseIcon />
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={importing || syncing || submitting || importingWishlist}
            >
              <FileArrowDownIcon />
              {importing ? "Importing..." : "Import from Steam"}
            </Button>
            <ImportSteamWishlistButton
              disabled={syncing || importing || submitting}
              onBusyChange={setImportingWishlist}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={submitting || importing || syncing || importingWishlist}
            >
              <PlugsConnectedIcon />
              {submitting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Link href="/api/steam/connect">
            <Button size="sm">
              <SourceIcon iconName="MonitorPlay" brandIcon="steam.svg" />
              Connect Steam
            </Button>
          </Link>
        )}
      </div>
    </SectionCard>
  );
}
