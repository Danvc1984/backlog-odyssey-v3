"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { SectionCard } from "@/components/ui/detail-card";

export function DeleteWishlistEntrySection({
  entryId,
  entryName,
}: {
  entryId: string;
  entryName: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteWishlistEntry({ id: entryId });
    setDeleting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to delete wishlist entry");
      return;
    }
    setConfirmOpen(false);
    toast.success(`Removed "${entryName}" from wishlist`);
    router.push("/wishlist");
  };

  return (
    <SectionCard
      eyebrow="Danger zone"
      title="Remove from wishlist"
      description="Permanently remove this entry and its locally stored wishlist data."
      tone="danger"
      aside={
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm" disabled={deleting}>
              Remove entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove wishlist entry?</DialogTitle>
              <DialogDescription>
                This will permanently remove &quot;{entryName}&quot; from your wishlist. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => void remove()} disabled={deleting}>
                {deleting ? "Removing..." : "Remove entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <p className="text-sm text-muted-foreground">
        This only affects the wishlist entry. Your catalog games and provider records stay unchanged.
      </p>
    </SectionCard>
  );
}
