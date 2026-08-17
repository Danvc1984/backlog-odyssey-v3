"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addGameToCollection, removeGameFromCollection } from "@/actions/collections";
import { FolderPlus, X } from "lucide-react";

type CollectionData = {
  id: string;
  name: string;
  color: string | null;
};

export function CollectionsSection({
  gameId,
  initialCollections,
  availableCollections,
}: {
  gameId: string;
  initialCollections: CollectionData[];
  availableCollections: CollectionData[];
}) {
  const router = useRouter();
  const [collections, setCollections] = useState(initialCollections);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRemove = async (collectionId: string) => {
    setSubmitting(true);

    const result = await removeGameFromCollection(collectionId, gameId);

    setSubmitting(false);

    if (result.success) {
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
      toast.success("Removed from collection");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove");
    }
  };

  const handleAdd = async (collectionId: string, name: string) => {
    setSubmitting(true);

    const result = await addGameToCollection(collectionId, gameId);

    setSubmitting(false);

    if (result.success) {
      const added = availableCollections.find((c) => c.id === collectionId);
      if (added && !collections.some((c) => c.id === added.id)) {
        setCollections((prev) => [...prev, added]);
      }
      setPickerOpen(false);
      toast.success(`Added to "${name}"`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to add");
    }
  };

  const available = availableCollections.filter(
    (c) => !collections.some((existing) => existing.id === c.id),
  );

  return (
    <div>
      {collections.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {collections.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: c.color ?? "#9ca3af" }}
                aria-hidden
              />
              {c.name}
              <button
                type="button"
                aria-label={`Remove from ${c.name}`}
                className="text-muted-foreground hover:text-foreground"
                disabled={submitting}
                onClick={() => handleRemove(c.id)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {pickerOpen ? (
        <div className="rounded-lg border border-border bg-muted/20 p-2">
          {available.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              No other collections to add to.
            </p>
          ) : (
            <ul className="grid gap-1">
              {available.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    disabled={submitting}
                    onClick={() => handleAdd(c.id, c.name)}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: c.color ?? "#9ca3af" }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full"
            onClick={() => setPickerOpen(false)}
          >
            Close
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
        >
          <FolderPlus />
          Add to collection
        </Button>
      )}
    </div>
  );
}