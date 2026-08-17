"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCollection, deleteCollection } from "@/actions/collections";
import { CollectionColorPicker } from "./CollectionColorPicker";

interface CollectionDetailActionsProps {
  collectionId: string;
  initialName: string;
  initialColor: string | null;
}

export function CollectionDetailActions({
  collectionId,
  initialName,
  initialColor,
}: CollectionDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = () => {
    setName(initialName);
    setColor(initialColor ?? "");
    setError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await updateCollection(collectionId, {
      name,
      color: color || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      toast.success(`Renamed to "${name}"`);
      setEditOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to update collection");
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    const result = await deleteCollection(collectionId);

    setSubmitting(false);

    if (result.success) {
      toast.success("Collection deleted");
      router.push("/collections");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to delete collection");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (next) openEdit();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Update the name or color.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-color">Color (optional)</Label>
              <CollectionColorPicker color={color} onColorChange={setColor} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (next) setError(null);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete collection?</DialogTitle>
            <DialogDescription>
              &quot;{initialName}&quot; and its memberships will be removed. The games
              themselves stay in your library.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
