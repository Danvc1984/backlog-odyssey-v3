"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  enrichWishlistEntryWithIgdb,
  refreshWishlistIgdbMetadata,
  searchWishlistIgdb,
} from "@/actions/wishlist-igdb";
import { Button } from "@/components/ui/button";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import type { IgdbSearchCandidate } from "@/lib/igdb-types";

const AMBIGUOUS_MATCH_MESSAGE = "Several IGDB games share this title.";

export function WishlistIgdbEnrichmentControl({
  wishlistEntryId,
  entryName,
  hasSnapshot,
}: {
  wishlistEntryId: string;
  entryName: string;
  hasSnapshot: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [candidates, setCandidates] = useState<IgdbSearchCandidate[]>([]);
  const [candidatePage, setCandidatePage] = useState(1);
  const [showCandidates, setShowCandidates] = useState(false);
  const [selectedIgdbId, setSelectedIgdbId] = useState<number | null>(null);

  const searchCandidates = async (page = 1) => {
    setLoading(true);
    try {
      const result = await searchWishlistIgdb({ title: entryName, page });
      if (!result.success) {
        toast.error(result.error ?? "Failed to search IGDB matches");
        return;
      }
      setCandidates((current) => page === 1
        ? result.data
        : [...current, ...result.data.filter((candidate) => !current.some((item) => item.id === candidate.id))]);
      setCandidatePage(page);
      setShowCandidates(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search IGDB matches");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (message: "loaded" | "refreshed", result: { steamAppIdApplied: string | null; steamAppIdConflict: string | null }) => {
    setConfirmOverwrite(false);
    setShowCandidates(false);
    setSelectedIgdbId(null);
    toast.success(`IGDB metadata ${message}`);
    if (result.steamAppIdApplied) toast.success(`Steam App ${result.steamAppIdApplied} applied from IGDB`);
    if (result.steamAppIdConflict) toast.warning(result.steamAppIdConflict);
    router.refresh();
  };

  const applyCandidate = async (igdbId: number, confirm = false) => {
    setSelectedIgdbId(igdbId);
    setLoading(true);
    try {
      const result = await enrichWishlistEntryWithIgdb({
        wishlistEntryId,
        igdbId,
        confirmOverwrite: confirm,
      });
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to save IGDB match");
        return;
      }
      if ("kind" in result.data) {
        setConfirmOverwrite(true);
        return;
      }
      handleSuccess(hasSnapshot ? "refreshed" : "loaded", result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save IGDB match");
    } finally {
      setLoading(false);
    }
  };

  const load = async (confirm = false) => {
    setLoading(true);
    try {
      const result = await refreshWishlistIgdbMetadata({ wishlistEntryId, confirmOverwrite: confirm });
      if (!result.success || !result.data) {
        if (result.error?.startsWith(AMBIGUOUS_MATCH_MESSAGE)) {
          setConfirmOverwrite(false);
          await searchCandidates();
        } else {
          toast.error(result.error ?? "Failed to load IGDB metadata");
        }
        return;
      }
      if ("kind" in result.data) {
        setConfirmOverwrite(true);
        return;
      }
      handleSuccess(hasSnapshot ? "refreshed" : "loaded", result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load IGDB metadata");
    } finally {
      setLoading(false);
    }
  };

  const status = loading
    ? (hasSnapshot ? "Refreshing" : "Loading")
    : showCandidates
      ? "AWAITING MATCH"
      : hasSnapshot
        ? "Loaded"
        : "Ready";

  return (
    <SectionCard
        title="Enrichment"
      id="wishlist-igdb-enrichment-heading"
      description="Refresh matched game information."
      status={<StatusPill tone={loading || confirmOverwrite || showCandidates ? "warning" : "neutral"}>{confirmOverwrite ? "Confirm refresh" : status}</StatusPill>}
    >
      {confirmOverwrite ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Replace the current IGDB metadata?</p>
          <p className="mt-1 text-muted-foreground">The current snapshot stays visible unless the replacement is successfully saved.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => selectedIgdbId === null ? void load(true) : void applyCandidate(selectedIgdbId, true)}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Replace metadata"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOverwrite(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {!showCandidates && (
              <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void searchCandidates()}>
                {loading ? "Searching..." : "Choose another match"}
              </Button>
            )}
            {!hasSnapshot && !showCandidates && (
              <Button type="button" size="sm" disabled={loading} onClick={() => void load()}>
                {loading ? "Loading..." : "Load IGDB metadata"}
              </Button>
            )}
            {hasSnapshot && !showCandidates && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={loading}
                onClick={() => void load()}
                aria-label="Refresh IGDB metadata"
                title="Refresh IGDB metadata"
              >
                <ArrowClockwiseIcon aria-hidden="true" className={loading ? "animate-spin" : undefined} />
              </Button>
            )}
          </div>
        </div>
      )}

      {showCandidates && !confirmOverwrite && (
        <div className="mt-4 space-y-3 text-sm">
          <p>Choose the correct IGDB result to continue.</p>
          {candidates.length > 0 ? (
            <div className="grid gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={loading}
                  onClick={() => void applyCandidate(candidate.id)}
                  className="flex gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className="size-16 shrink-0 rounded bg-muted bg-cover bg-center"
                    style={candidate.coverUrl ? { backgroundImage: `url(${candidate.coverUrl})` } : undefined}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{candidate.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {candidate.firstReleaseDate
                        ? new Date(candidate.firstReleaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : "Release date unavailable"}
                    </span>
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between gap-2 pt-1">
                {candidates.length >= candidatePage * 30 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void searchCandidates(candidatePage + 1)} disabled={loading}>
                    {loading ? "Loading..." : "Load more results"}
                  </Button>
                )}
              </div>
              <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setShowCandidates(false)}>
                None of these match
              </Button>
            </div>
          ) : (
            <p className="rounded-md border border-border p-3 text-muted-foreground">No IGDB matches were found.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
