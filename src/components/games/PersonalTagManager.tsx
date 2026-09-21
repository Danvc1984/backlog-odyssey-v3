"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPersonalTag, deletePersonalTag, renamePersonalTag } from "@/actions/personal-tags";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagIcon } from "@phosphor-icons/react";

export interface PersonalTagManagerItem {
  id: string;
  name: string;
  count: number;
}

export function PersonalTagManager({ initialTags }: { initialTags: PersonalTagManagerItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(initialTags);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTags.map((tag) => [tag.id, tag.name])),
  );
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [pendingMerge, setPendingMerge] = useState<{ tagId: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PersonalTagManagerItem | null>(null);
  const firstInvalidRef = useRef<HTMLInputElement>(null);

  const actionError = (field: string, message: string) => {
    setError({ field, message });
    requestAnimationFrame(() => firstInvalidRef.current?.focus());
  };

  const createTag = async () => {
    if (!newName.trim() || pending) {
      actionError("new", "Tag name is required");
      return;
    }
    setPending("new");
    setError(null);
    const result = await createPersonalTag({ name: newName });
    setPending(null);
    if (!result.success) {
      actionError("new", result.error ?? "Failed to create tag");
      return;
    }
    if (!tags.some((tag) => tag.id === result.data.id)) {
      setTags((current) => [...current, { id: result.data.id, name: result.data.name, count: 0 }]);
    }
    setNewName("");
    toast.success(`Tag "${result.data.name}" is ready`);
    router.refresh();
  };

  const renameTag = async (tag: PersonalTagManagerItem, confirmMerge = false) => {
    const name = drafts[tag.id] ?? "";
    if (!name.trim() || pending) {
      actionError(tag.id, "Tag name is required");
      return;
    }
    setPending(tag.id);
    setError(null);
    const result = await renamePersonalTag({ tagId: tag.id, name, confirmMerge });
    setPending(null);
    if (!result.success) {
      if (!confirmMerge && result.error?.includes("confirm merge")) {
        setPendingMerge({ tagId: tag.id, name });
        actionError(tag.id, result.error);
      } else {
        actionError(tag.id, result.error ?? "Failed to rename tag");
      }
      return;
    }
    setPendingMerge(null);
    const mergeData = result.data as { id: string; name: string; count?: number; mergedTagId?: string };
    const mergedTagId = mergeData.mergedTagId;
    const mergedCount = mergeData.count;
    if (mergedTagId && mergedCount !== undefined) {
      setTags((current) => current
        .filter((item) => item.id !== mergedTagId)
        .map((item) => item.id === mergeData.id ? { ...item, name: mergeData.name, count: mergedCount } : item));
      setDrafts((current) => {
        const next = { ...current };
        delete next[mergedTagId];
        next[mergeData.id] = mergeData.name;
        return next;
      });
    } else {
      setTags((current) => current.map((item) =>
        item.id === tag.id ? { ...item, name: mergeData.name } : item,
      ));
    }
    toast.success(`Renamed tag to "${result.data.name}"`);
    router.refresh();
  };

  const deleteTag = async (tag: PersonalTagManagerItem) => {
    if (pending) return;
    setPending(tag.id);
    setError(null);
    const result = await deletePersonalTag({ tagId: tag.id });
    setPending(null);
    if (!result.success) {
      actionError(tag.id, result.error ?? "Failed to delete tag");
      return;
    }
    setTags((current) => current.filter((item) => item.id !== tag.id));
    setPendingDelete(null);
    toast.success(`Deleted tag "${tag.name}"`);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setError(null); setPendingMerge(null); setPendingDelete(null); } }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <TagIcon aria-hidden />
          Manage tags
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage personal tags</DialogTitle>
          <DialogDescription>
            Tags are the only owner-managed grouping model. Every tag remains a browsable shelf, including empty tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              ref={firstInvalidRef}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Create an empty tag"
              aria-label="New tag name"
              aria-invalid={error?.field === "new"}
              aria-describedby={error?.field === "new" ? "personal-tag-error" : undefined}
              disabled={pending !== null}
            />
            <Button type="button" onClick={() => void createTag()} disabled={pending !== null}>
              {pending === "new" ? "Creating…" : "Create"}
            </Button>
          </div>

          {tags.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-card-alt/30 px-3 py-6 text-center text-sm text-muted-foreground">
              No personal tags yet. Create your first empty shelf above.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {tags.map((tag) => {
                const isPendingMerge = pendingMerge?.tagId === tag.id;
                const isPendingDelete = pendingDelete?.id === tag.id;
                return (
                  <div key={tag.id} className="rounded-md border border-border bg-card-alt/30 p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={isPendingMerge || error?.field === tag.id ? firstInvalidRef : undefined}
                        value={drafts[tag.id] ?? tag.name}
                        onChange={(event) => setDrafts((current) => ({ ...current, [tag.id]: event.target.value }))}
                        aria-label={`Name for ${tag.name}`}
                        aria-invalid={error?.field === tag.id}
                        aria-describedby={error?.field === tag.id ? "personal-tag-error" : undefined}
                        disabled={pending !== null}
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">{tag.count} {tag.count === 1 ? "game" : "games"}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void renameTag(tag)} disabled={pending !== null}>
                        {pending === tag.id ? "Saving…" : "Rename"}
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDelete(tag)} disabled={pending !== null}>
                        Delete
                      </Button>
                    </div>
                    {isPendingMerge && (
                      <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        A tag with this normalized name already exists. Merge memberships and active Tune references into that tag?
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="sm" onClick={() => void renameTag(tag, true)} disabled={pending !== null}>
                            {pending === tag.id ? "Merging…" : "Confirm merge"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setPendingMerge(null)} disabled={pending !== null}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    {isPendingDelete && (
                      <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                        Delete this tag and remove it from {tag.count} {tag.count === 1 ? "game" : "games"}? The games will remain.
                        <div className="mt-2 flex gap-2">
                          <Button type="button" variant="destructive" size="sm" onClick={() => void deleteTag(tag)} disabled={pending !== null}>
                            {pending === tag.id ? "Deleting…" : "Confirm delete"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setPendingDelete(null)} disabled={pending !== null}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error && <p id="personal-tag-error" role="alert" className="text-sm text-destructive">{error.message}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending !== null}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
