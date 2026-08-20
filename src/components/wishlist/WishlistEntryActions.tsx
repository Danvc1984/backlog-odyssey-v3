"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

interface WishlistEntryActionsProps {
  entry: { id: string; name: string; type: string; baseGameId: string | null; interest: number | null };
  baseGames: { id: string; name: string }[];
}

export function WishlistEntryActions({ entry, baseGames }: WishlistEntryActionsProps) {
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
      <AcquireWishlistDialog entry={entry} />
      <EditWishlistDialog entry={entry} baseGames={baseGames} />
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setError(null);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" disabled={deleting} aria-label={`Delete ${entry.name}`}>
            <Trash2 />
          </Button>
        </DialogTrigger>
        <DialogContent>
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
    </div>
  );
}
