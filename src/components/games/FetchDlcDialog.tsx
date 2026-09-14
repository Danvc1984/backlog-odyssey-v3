"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { acquireFetchedDlcs, fetchDlcCandidates } from "@/actions/dlc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui/detail-card";

interface Candidate {
  steamAppId: string;
  name: string;
  resolvedVia: "IGDB" | "STEAM" | "APP_ID";
  owned: boolean;
  wishlisted: boolean;
}

export function FetchDlcDialog({ baseGameId }: { baseGameId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDlcCandidates({ baseGameId });
    setLoading(false);
    if (!result.success) {
      setCandidates([]);
      setError(result.error ?? "Failed to fetch DLC list");
      return;
    }
    setCandidates(result.data as Candidate[]);
    setSelected(new Set());
  };

  const submit = async () => {
    const items = candidates
      .filter((candidate) => selected.has(candidate.steamAppId))
      .map(({ steamAppId, name }) => ({ steamAppId, name }));
    setSubmitting(true);
    setError(null);
    const result = await acquireFetchedDlcs({ baseGameId, items });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to acquire DLC");
      return;
    }
    toast.success(`${result.data.created.length} DLC${result.data.created.length === 1 ? "" : "s"} acquired; ${result.data.skipped} skipped`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
        else {
          setCandidates([]);
          setSelected(new Set());
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <DownloadSimpleIcon />
          Fetch DLC list
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fetch DLC list</DialogTitle>
          <DialogDescription>
            Review Steam&apos;s DLC list and select only the expansions you want to add.
            Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground" aria-live="polite">
            Fetching DLC list…
          </p>
        ) : error ? (
          <div className="grid gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive" role="alert">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="w-fit">
              <ArrowClockwiseIcon /> Retry
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No DLC listed on Steam.
          </p>
        ) : (
          <div className="grid gap-2" role="group" aria-label="Steam DLC list">
            {candidates.map((candidate) => {
              const disabled = candidate.owned || candidate.wishlisted;
              return (
                <label
                  key={candidate.steamAppId}
                  className={`flex items-center gap-3 rounded-md border border-border p-3 ${disabled ? "opacity-60" : "hover:bg-muted/40"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.steamAppId)}
                    disabled={disabled || submitting}
                    onChange={(event) => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(candidate.steamAppId);
                        else next.delete(candidate.steamAppId);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{candidate.name}</span>
                    {candidate.resolvedVia === "APP_ID" && (
                      <span className="block text-xs text-muted-foreground">Steam App {candidate.steamAppId}</span>
                    )}
                  </span>
                  {candidate.owned && <StatusPill tone="ok">Owned</StatusPill>}
                  {candidate.wishlisted && <StatusPill tone="signal">In wishlist</StatusPill>}
                </label>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => void submit()} disabled={loading || submitting || selected.size === 0}>
            {submitting ? "Acquiring…" : `Acquire selected (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
