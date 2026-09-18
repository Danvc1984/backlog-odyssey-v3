"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon } from "@phosphor-icons/react";
import { deleteWishlistEntry } from "@/actions/wishlist";
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
import { EditWishlistDialog } from "./EditWishlistDialog";
import { AcquireWishlistDialog } from "./AcquireWishlistDialog";
import type { WishlistOfferView } from "@/types/wishlist-offers";

interface WishlistEntryActionsProps {
  entry: { id: string; name: string; type: string; baseGameId: string | null; interest: number | null; gameExperience: string | null; handheldSuitable: boolean | null };
  baseGames: { id: string; name: string }[];
  showDelete?: boolean;
  imageUrl?: string | null;
  selectedOffer?: WishlistOfferView | null;
  alternativeSources?: { id: string; name: string; iconName: string; brandIcon?: string }[];
}

export function WishlistEntryActions({ entry, baseGames, showDelete = true, imageUrl, selectedOffer, alternativeSources }: WishlistEntryActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteWishlistEntry({ id: entry.id });
    setDeleting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to delete wishlist entry");
      return;
    }
    setConfirmOpen(false);
    toast.success(`Removed "${entry.name}" from wishlist`);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <AcquireWishlistDialog
        entry={entry}
        imageUrl={imageUrl}
        selectedOffer={selectedOffer}
        alternativeSources={alternativeSources}
      />
      <EditWishlistDialog entry={entry} baseGames={baseGames} />
      {showDelete && (
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              className="bg-red-950/80 text-red-200 hover:bg-red-900/90 hover:text-red-100"
              disabled={deleting}
              aria-label={`Delete ${entry.name}`}
              title="Delete wishlist entry"
            >
              <TrashIcon />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete wishlist entry?</DialogTitle>
              <DialogDescription>
                This will permanently remove &quot;{entry.name}&quot; from your wishlist. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => void remove()} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete wishlist entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
