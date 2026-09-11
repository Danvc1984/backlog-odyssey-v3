"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { updateWishlistEntry } from "@/actions/wishlist";
import { enrichWishlistEntryWithIgdb, searchWishlistIgdb } from "@/actions/wishlist-igdb";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IgdbSearchCandidate } from "@/lib/igdb-types";
import { GAME_EXPERIENCE_LABELS, PERSONAL_FIELD_HELP } from "@/lib/personal-field-help";

interface EditWishlistDialogProps {
  entry: { id: string; name: string; type: string; baseGameId: string | null; interest: number | null; gameExperience: string | null; handheldSuitable: boolean | null };
  baseGames: { id: string; name: string }[];
}

export function EditWishlistDialog({ entry, baseGames }: EditWishlistDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.name);
  const [interest, setInterest] = useState(String(entry.interest ?? 5));
  const [baseGameId, setBaseGameId] = useState(entry.baseGameId ?? "");
  const [gameExperience, setGameExperience] = useState(entry.gameExperience ?? "");
  const [handheldSuitable, setHandheldSuitable] = useState(entry.handheldSuitable === true);
  const [candidates, setCandidates] = useState<IgdbSearchCandidate[]>([]);
  const [selectedIgdbId, setSelectedIgdbId] = useState<number | null>(null);
  const [igdbPage, setIgdbPage] = useState(1);
  const [pendingOverwrite, setPendingOverwrite] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchIgdb = async () => {
    setSearching(true);
    setError(null);
    const result = await searchWishlistIgdb({ title: name });
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? "IGDB search failed");
      return;
    }
    setCandidates(result.data);
    setSelectedIgdbId(null);
    setIgdbPage(1);
  };

  const loadMoreIgdb = async () => {
    const nextPage = igdbPage + 1;
    setSearching(true);
    setError(null);
    const result = await searchWishlistIgdb({ title: name, page: nextPage });
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? "IGDB search failed");
      return;
    }
    const knownIds = new Set(candidates.map((candidate) => candidate.id));
    setCandidates((current) => [
      ...current,
      ...result.data.filter((candidate) => !knownIds.has(candidate.id)),
    ]);
    setIgdbPage(nextPage);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateWishlistEntry({
      id: entry.id,
      name,
      interest: Number(interest),
      gameExperience: gameExperience === "" ? null : gameExperience as keyof typeof GAME_EXPERIENCE_LABELS,
      handheldSuitable: handheldSuitable ? true : null,
      ...(entry.type === "DLC" && { baseGameId }),
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to update wishlist entry");
      return;
    }
    if (entry.type === "BASE_GAME" && selectedIgdbId !== null) {
      const enrichment = await enrichWishlistEntryWithIgdb({
        wishlistEntryId: entry.id,
        igdbId: selectedIgdbId,
        confirmOverwrite: pendingOverwrite,
      });
      if (enrichment.success && enrichment.data && "kind" in enrichment.data && enrichment.data.kind === "OVERWRITE_REQUIRED") {
        setPendingOverwrite(true);
        setSubmitting(false);
        return;
      }
      if (!enrichment.success) {
        toast.error(`Wishlist updated, but IGDB failed: ${enrichment.error}`);
      } else if (!("kind" in enrichment.data) && enrichment.data.steamAppIdApplied) {
        toast.success(`Steam App ${enrichment.data.steamAppIdApplied} applied from IGDB`);
      }
      if (enrichment.success && !("kind" in enrichment.data) && enrichment.data.steamAppIdConflict) {
        toast.warning(enrichment.data.steamAppIdConflict);
      }
    }
    setOpen(false);
    router.refresh();
    toast.success(`Updated "${name}"`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjust wishlist entry</DialogTitle>
          <DialogDescription>Set the local details for this entry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor={`edit-wishlist-name-${entry.id}`}>
            {entry.type === "BASE_GAME" ? "Name and IGDB match" : "Name"}
            </Label>
            <div className="flex gap-2">
              <Input id={`edit-wishlist-name-${entry.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
              {entry.type === "BASE_GAME" && (
                <Button type="button" variant="outline" onClick={() => void searchIgdb()} disabled={searching || !name.trim()}>
                  <MagnifyingGlassIcon />
                  {searching ? "Searching" : "Search"}
                </Button>
              )}
            </div>
          </div>
          {entry.type === "BASE_GAME" && candidates.length > 0 && (
            <div className="grid gap-2">
              <Label>IGDB selection</Label>
              {selectedIgdbId !== null && (
                <div className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
                  <p className="font-medium">Selected IGDB match</p>
                  <p>{candidates.find((candidate) => candidate.id === selectedIgdbId)?.name}</p>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => { setSelectedIgdbId(null); setPendingOverwrite(false); }}>
                    Clear selection
                  </Button>
                </div>
              )}
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border p-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`flex gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${selectedIgdbId === candidate.id ? "bg-muted" : ""}`}
                    onClick={() => {
                      setSelectedIgdbId(candidate.id);
                      setName(candidate.name);
                    }}
                  >
                    <span
                      className="size-16 shrink-0 rounded bg-muted bg-cover bg-center"
                      style={candidate.coverUrl ? { backgroundImage: `url(${candidate.coverUrl})` } : undefined}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 self-center">
                      <span className="block font-medium">{candidate.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {candidate.firstReleaseDate ? new Date(candidate.firstReleaseDate).toLocaleDateString("en-US", { year: "numeric" }) : "Release date unavailable"}
                      </span>
                    </span>
                  </button>
                ))}
                {candidates.length >= igdbPage * 30 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void loadMoreIgdb()} disabled={searching}>
                    {searching ? "Loading..." : "Load more IGDB matches"}
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`edit-wishlist-interest-${entry.id}`}>Interest</Label>
            <p className="text-xs text-muted-foreground">{PERSONAL_FIELD_HELP.interest}</p>
            <Select value={interest} onValueChange={setInterest}>
              <SelectTrigger id={`edit-wishlist-interest-${entry.id}`} aria-label="Wishlist interest"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1].map((value) => <SelectItem key={value} value={String(value)}>{value} star{value === 1 ? "" : "s"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-wishlist-experience-${entry.id}`}>Game experience</Label>
            <p className="text-xs text-muted-foreground">{PERSONAL_FIELD_HELP.gameExperience}</p>
            <Select value={gameExperience} onValueChange={setGameExperience}>
              <SelectTrigger id={`edit-wishlist-experience-${entry.id}`}><SelectValue placeholder="Not set" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Not set</SelectItem>
                {Object.entries(GAME_EXPERIENCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={handheldSuitable}
              disabled={submitting}
              onChange={(event) => setHandheldSuitable(event.target.checked)}
              className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            Handheld option
          </Label>
          {entry.type === "DLC" && (
            <div className="grid gap-2">
              <Label htmlFor={`edit-wishlist-parent-${entry.id}`}>Base game</Label>
              <Select value={baseGameId} onValueChange={setBaseGameId}>
                <SelectTrigger id={`edit-wishlist-parent-${entry.id}`} aria-label="Wishlist base game"><SelectValue placeholder="Choose a base game" /></SelectTrigger>
                <SelectContent>
                  {baseGames.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {pendingOverwrite && <div className="rounded-md border border-signal p-3 text-sm"><p className="font-medium">Replace the existing IGDB metadata?</p><p className="text-muted-foreground">Saving this match will replace the current metadata snapshot.</p><p className="mt-2">Submit again to confirm.</p></div>}
          <DialogFooter><Button type="submit" disabled={submitting || (entry.type === "DLC" && !baseGameId)}>{submitting ? "Saving..." : "Save changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
