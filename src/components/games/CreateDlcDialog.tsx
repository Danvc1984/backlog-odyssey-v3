"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createDlc } from "@/actions/dlc";
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

export function CreateDlcDialog({ baseGameId }: { baseGameId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [availabilitySource, setAvailabilitySource] = useState("STEAM");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAvailabilitySource("STEAM");
    setDisplayName("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createDlc({
      name,
      baseGameId,
      availabilitySource: availabilitySource as "STEAM" | "OTHER_PLATFORM" | "ROM",
      displayName: displayName || undefined,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to create DLC");
      return;
    }

    toast.success(`Created "${name}"`);
    setOpen(false);
    reset();
    router.refresh();
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
        <Button type="button" variant="outline" size="sm">
          <Plus />
          Add DLC
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add DLC</DialogTitle>
          <DialogDescription>
            Add a DLC entry attached to this base game.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dlc-name">Name</Label>
            <Input
              id="dlc-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. The Frozen Wilds"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dlc-source">Availability</Label>
            <select
              id="dlc-source"
              value={availabilitySource}
              onChange={(event) => setAvailabilitySource(event.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              <option value="STEAM">Steam</option>
              <option value="OTHER_PLATFORM">Other platform</option>
              <option value="ROM">ROM</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dlc-display-name">Display name (optional)</Label>
            <Input
              id="dlc-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Steam edition"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add DLC"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
