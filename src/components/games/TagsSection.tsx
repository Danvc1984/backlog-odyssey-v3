"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTagToGame } from "@/actions/game-detail";
import { Plus } from "lucide-react";

type TagData = {
  id: string;
  name: string;
};

export function TagsSection({
  gameId,
  initialTags,
}: {
  gameId: string;
  initialTags: TagData[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Tag name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await addTagToGame(gameId, { tagName: trimmed });

    setSubmitting(false);

    if (result.success) {
      const alreadyExists = tags.some((t) => t.id === result.data.id);
      if (!alreadyExists) {
        setTags((prev) => [...prev, { id: result.data.id, name: trimmed }]);
      }
      setInput("");
      toast.success(
        alreadyExists ? `Tag "${trimmed}" already exists` : `Tag "${trimmed}" added`,
      );
      router.refresh();
    } else {
      setError(result.error ?? "Failed to add tag");
    }
  }, [input, gameId, router, tags]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag..."
          className="max-w-56"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={submitting}
        >
          <Plus />
        </Button>
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
