"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { createCollection } from "@/actions/collections";
import { CollectionColorPicker } from "./CollectionColorPicker";
import { FolderPlus } from "lucide-react";

export function CreateCollectionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setColor("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createCollection({
      name,
      color: color || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      toast.success(`Created "${name}"`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to create collection");
    }
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
        <Button>
          <FolderPlus />
          New collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group games together, e.g. "Cozy games" or "Local co-op".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cozy games"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="color">Color (optional)</Label>
            <CollectionColorPicker color={color} onColorChange={setColor} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}