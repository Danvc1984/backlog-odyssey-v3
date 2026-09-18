"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deletePersonalTag } from "@/actions/personal-tags";
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

export function PersonalTagDeleteDialog({
  tagId,
  tagName,
  gameCount,
}: {
  tagId: string;
  tagName: string;
  gameCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deletePersonalTag({ tagId });
    setDeleting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to delete tag");
      return;
    }

    setOpen(false);
    toast.success(`Deleted tag "${tagName}"`);
    router.push("/collections");
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-red-500/40 text-red-300 hover:bg-red-950/60 hover:text-red-200"
        >
          Delete this tag
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete personal tag?</DialogTitle>
          <DialogDescription>
            Deleting <span className="font-medium">{tagName}</span> will remove this tag from {gameCount} {gameCount === 1 ? "game" : "games"}.
            The games themselves will not be deleted.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
