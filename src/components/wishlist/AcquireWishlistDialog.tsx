"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acquireWishlistBaseGame, acquireWishlistDlc } from "@/actions/wishlist";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AcquisitionSource = "STEAM" | "OTHER_PLATFORM" | "ROM";
type ParentPlayState = "NOT_STARTED" | "IN_PROGRESS" | "PLAN_TO_PLAY";

export function AcquireWishlistDialog({
  entry,
}: {
  entry: { id: string; name: string; type: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<AcquisitionSource>(
    entry.type === "DLC" ? "OTHER_PLATFORM" : "STEAM",
  );
  const [parentPlayState, setParentPlayState] = useState<ParentPlayState | "NONE">("NONE");
  const [parentReplay, setParentReplay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSource(entry.type === "DLC" ? "OTHER_PLATFORM" : "STEAM");
    setParentPlayState("NONE");
    setParentReplay(false);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = entry.type === "DLC"
      ? await acquireWishlistDlc({
          wishlistEntryId: entry.id,
          source,
          ...(parentPlayState !== "NONE" && { updateParentPlayState: parentPlayState }),
          setParentReplay: parentReplay,
        })
      : await acquireWishlistBaseGame({
          wishlistEntryId: entry.id,
          source,
        });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to acquire wishlist entry");
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
    toast.success(`Acquired "${entry.name}"`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">Acquire</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acquire {entry.type === "DLC" ? "DLC" : "base game"}</DialogTitle>
          <DialogDescription>
            Remove &quot;{entry.name}&quot; from the wishlist and add it to your catalog.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`acquire-source-${entry.id}`}>Source</Label>
            <Select value={source} onValueChange={(value) => setSource(value as AcquisitionSource)}>
              <SelectTrigger id={`acquire-source-${entry.id}`} aria-label="Acquisition source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STEAM">Steam</SelectItem>
                <SelectItem value="OTHER_PLATFORM">Other platform</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entry.type === "DLC" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`acquire-parent-state-${entry.id}`}>Parent play state (optional)</Label>
                <Select value={parentPlayState} onValueChange={(value) => setParentPlayState(value as ParentPlayState | "NONE")}>
                  <SelectTrigger id={`acquire-parent-state-${entry.id}`} aria-label="Parent play state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No change</SelectItem>
                    <SelectItem value="NOT_STARTED">Not started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="PLAN_TO_PLAY">Plan to play</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={parentReplay}
                  onChange={(event) => setParentReplay(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                Mark parent as replay candidate
              </label>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Acquiring..." : "Confirm acquisition"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
