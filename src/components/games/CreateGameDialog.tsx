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
import { createGame } from "@/actions/games";
import { createAlternativeSource } from "@/actions/sources";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { suggestSources } from "@/lib/sources/known-sources";
import { Plus } from "lucide-react";

type SourceValue = "STEAM" | "ROM" | "CUSTOM" | `ALT:${string}`;

interface CreateGameDialogProps {
  alternativeSources?: { id: string; name: string; iconName: string }[];
}

export function CreateGameDialog({ alternativeSources = [] }: CreateGameDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [source, setSource] = useState<SourceValue>("STEAM");
  const [sourceQuery, setSourceQuery] = useState("Steam");
  const [sourceListOpen, setSourceListOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDisplayName("");
    setSource("STEAM");
    setSourceQuery("Steam");
    setSourceListOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let alternativeSourceId: string | undefined;
    if (source.startsWith("ALT:")) {
      alternativeSourceId = source.slice(4);
    } else if (source === "CUSTOM") {
      const sourceResult = await createAlternativeSource({ name: sourceQuery });
      if (!sourceResult.success) {
        setSubmitting(false);
        setError(sourceResult.error ?? "Failed to create source");
        return;
      }
      alternativeSourceId = sourceResult.data.id;
    }

    const availabilitySource = source === "ROM" ? "ROM" : source === "STEAM" ? "STEAM" : "OTHER_PLATFORM";
    const result = await createGame({
      name,
      availabilitySource,
      ...(alternativeSourceId && { alternativeSourceId }),
      displayName: displayName || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      toast.success(`Added "${name}" to the library`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to add game");
    }
  };

  const knownSuggestions = suggestSources(sourceQuery, alternativeSources).known;
  const builtInSuggestions = [
    { value: "STEAM" as const, label: "Steam", iconName: "MonitorPlay" },
    { value: "ROM" as const, label: "ROM", iconName: "Disc3" },
  ].filter((option) => option.label.toLowerCase().includes(sourceQuery.trim().toLowerCase()));
  const savedSuggestions = alternativeSources
    .filter((option) => option.name.toLowerCase().includes(sourceQuery.trim().toLowerCase()))
    .map((option) => ({ ...option, label: option.name }));
  const suggestionCount = builtInSuggestions.length + savedSuggestions.length + knownSuggestions.length;
  const selectSource = (value: SourceValue, label: string) => {
    setSource(value);
    setSourceQuery(label);
    setSourceListOpen(false);
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
          <Plus />
          Add game
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add game</DialogTitle>
          <DialogDescription>
            Add a manually owned game to your catalog.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hollow Knight"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source">Availability</Label>
            <div className="relative">
              <Input
                id="source"
                value={sourceQuery}
                onFocus={() => setSourceListOpen(true)}
                onChange={(event) => {
                  setSourceQuery(event.target.value);
                  setSource("CUSTOM");
                  setActiveSuggestion(0);
                  setSourceListOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSourceListOpen(true);
                    setActiveSuggestion((index) => Math.min(index + 1, suggestionCount - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveSuggestion((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const builtIn = builtInSuggestions[activeSuggestion];
                    if (builtIn) return selectSource(builtIn.value, builtIn.label);
                    const savedIndex = activeSuggestion - builtInSuggestions.length;
                    const saved = savedSuggestions[savedIndex];
                    if (saved) return selectSource(`ALT:${saved.id}`, saved.name);
                    const knownIndex = savedIndex - savedSuggestions.length;
                    const known = knownSuggestions[knownIndex];
                    if (known) return selectSource("CUSTOM", known.label);
                    setSourceListOpen(false);
                  } else if (event.key === "Escape") {
                    setSourceListOpen(false);
                  }
                }}
                disabled={submitting}
                placeholder="Type a store or alias..."
              />
              {sourceListOpen && suggestionCount > 0 && (
                <ul role="listbox" className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
                  {[...builtInSuggestions, ...savedSuggestions.map((option) => ({ ...option, value: `ALT:${option.id}` as const })), ...knownSuggestions.map((option) => ({ value: "CUSTOM" as const, label: option.label, iconName: option.iconName }))].map((option, index) => (
                    <li key={`${option.value}-${option.label}`} role="option" aria-selected={index === activeSuggestion}>
                      <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSource(option.value, option.label)}>
                        <SourceIcon iconName={option.iconName} />
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">
              Display name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Hollow Knight (Epic)"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add game"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
