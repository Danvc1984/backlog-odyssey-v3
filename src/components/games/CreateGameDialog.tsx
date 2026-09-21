"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGame } from "@/actions/games";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { searchWishlistIgdb } from "@/actions/wishlist-igdb";
import type { IgdbSearchCandidate } from "@/lib/igdb-types";

type SourceValue = "STEAM" | "ROM" | `ALT:${string}`;

interface CreateGameDialogProps {
  alternativeSources?: { id: string; name: string; iconName: string; brandIcon?: string }[];
  triggerSize?: "default" | "lg";
}

export function CreateGameDialog({
  alternativeSources = [],
  triggerSize = "default",
}: CreateGameDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [interest, setInterest] = useState("3");
  const [candidates, setCandidates] = useState<IgdbSearchCandidate[]>([]);
  const [selectedIgdbId, setSelectedIgdbId] = useState<number | null>(null);
  const [igdbPage, setIgdbPage] = useState(1);
  const [igdbSearched, setIgdbSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [source, setSource] = useState<SourceValue>("STEAM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setInterest("3");
    setCandidates([]);
    setSelectedIgdbId(null);
    setIgdbPage(1);
    setIgdbSearched(false);
    setSource("STEAM");
    setError(null);
  };

  const searchIgdb = async (page = 1) => {
    setSearching(true);
    setError(null);
    const result = await searchWishlistIgdb({ title: name, page });
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? "IGDB search failed");
      return;
    }
    const knownIds = new Set(candidates.map((candidate) => candidate.id));
    setIgdbSearched(true);
    setCandidates((current) => page === 1 ? result.data : [...current, ...result.data.filter((candidate) => !knownIds.has(candidate.id))]);
    setSelectedIgdbId(page === 1 ? null : selectedIgdbId);
    setIgdbPage(page);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let alternativeSourceId: string | undefined;
    if (source.startsWith("ALT:")) {
      alternativeSourceId = source.slice(4);
    }

    const availabilitySource = source === "ROM" ? "ROM" : source === "STEAM" ? "STEAM" : "OTHER_PLATFORM";
    const result = await createGame({
      name,
      availabilitySource,
      ...(alternativeSourceId && { alternativeSourceId }),
      interest: Number(interest),
      selectedIgdbId: selectedIgdbId ?? undefined,
    });

    setSubmitting(false);

    if (result.success) {
      toast.success(`Added "${name}" to the library`);
      if (selectedIgdbId !== null) toast.success("IGDB enrichment queued");
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to add game");
    }
  };

  const sourceOptions: Array<{ value: SourceValue; label: string; iconName: string; brandIcon?: string }> = [
    { value: "STEAM", label: "Steam", iconName: "MonitorPlay", brandIcon: "steam.svg" },
    { value: "ROM", label: "ROM", iconName: "Disc3" },
    ...alternativeSources.map((option) => ({ value: `ALT:${option.id}` as const, label: option.name, iconName: option.iconName, brandIcon: option.brandIcon })),
  ];

  const selectSource = (value: SourceValue) => setSource(value);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size={triggerSize}>
          <PlusIcon />
          Add game
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a game to your catalog</DialogTitle>
          <DialogDescription>
            Fill out the form below to add a game to your library. You can optionally search for an IGDB match and select a source.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          
          <div className="grid gap-2">
            <Label htmlFor="igdb-name">Name and IGDB match</Label>
            <div className="flex gap-2">
              <Input className="min-w-0 flex-1" id="igdb-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={submitting} />
              <Button type="button" variant="outline" onClick={() => void searchIgdb()} disabled={searching || submitting || !name.trim()}>
                <MagnifyingGlassIcon />
                {searching ? "Searching" : "Search"}
              </Button>
            </div>
            {selectedIgdbId !== null && (
              <div className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
                <p className="font-medium">Selected IGDB match</p>
                <p>{candidates.find((candidate) => candidate.id === selectedIgdbId)?.name}</p>
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setSelectedIgdbId(null)} disabled={submitting}>
                  Clear selection
                </Button>
              </div>
            )}
            {igdbSearched && candidates.length === 0 && (
              <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">No IGDB matches were found.</p>
            )}
            {candidates.length > 0 && (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border p-2">
                {candidates.map((candidate) => (
                  <button key={candidate.id} type="button" disabled={submitting || searching} className={`flex gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${selectedIgdbId === candidate.id ? "bg-muted" : ""}`} onClick={() => { setSelectedIgdbId(candidate.id); setName(candidate.name); }}>
                    <span className="size-16 shrink-0 rounded bg-muted bg-cover bg-center" style={candidate.coverUrl ? { backgroundImage: `url(${candidate.coverUrl})` } : undefined} aria-hidden="true" />
                    <span className="min-w-0 self-center">
                      <span className="block font-medium">{candidate.name}</span>
                      <span className="block text-xs text-muted-foreground">{candidate.firstReleaseDate ? new Date(candidate.firstReleaseDate).toLocaleDateString("en-US", { year: "numeric" }) : "Release date unavailable"}</span>
                    </span>
                  </button>
                ))}
                {candidates.length >= igdbPage * 30 && <Button type="button" variant="ghost" size="sm" onClick={() => void searchIgdb(igdbPage + 1)} disabled={searching || submitting}>{searching ? "Loading..." : "Load more IGDB matches"}</Button>}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="interest">Interest</Label>
              <Select value={interest} onValueChange={setInterest} disabled={submitting}>
                <SelectTrigger id="interest" aria-label="Interest" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} star{value === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">Platform</Label>
              <Select
                value={source}
                onValueChange={(value) => selectSource(value as SourceValue)}
                disabled={submitting}
              >
                <SelectTrigger id="source" aria-label="Platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <SourceIcon iconName={option.iconName} brandIcon={option.brandIcon} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {alternativeSources.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Need another platform? Create an active reusable source in{" "}
                  <Link href="/settings#alternative-sources-heading" className="underline underline-offset-2">
                    Settings
                  </Link>.
                </p>
              )}
            </div>
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
