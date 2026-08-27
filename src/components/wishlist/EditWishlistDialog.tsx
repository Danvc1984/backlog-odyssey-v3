"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { updateWishlistEntry } from "@/actions/wishlist";
import { enrichWishlistEntryWithRawg, searchWishlistRawg } from "@/actions/wishlist-rawg";
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
import type { RawgSearchCandidate } from "@/lib/rawg-types";
import { GAME_EXPERIENCE_LABELS, PERSONAL_FIELD_HELP } from "@/lib/personal-field-help";

interface EditWishlistDialogProps {
  entry: { id: string; name: string; type: string; baseGameId: string | null; interest: number | null; gameExperience: string | null };
  baseGames: { id: string; name: string }[];
}

export function EditWishlistDialog({ entry, baseGames }: EditWishlistDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.name);
  const [interest, setInterest] = useState(String(entry.interest ?? 5));
  const [baseGameId, setBaseGameId] = useState(entry.baseGameId ?? "");
  const [gameExperience, setGameExperience] = useState(entry.gameExperience ?? "");
  const [candidates, setCandidates] = useState<RawgSearchCandidate[]>([]);
  const [selectedRawgId, setSelectedRawgId] = useState<number | null>(null);
  const [rawgPage, setRawgPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRawg = async () => {
    setSearching(true);
    setError(null);
    const result = await searchWishlistRawg({ title: name });
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? "RAWG search failed");
      return;
    }
    setCandidates(result.data);
    setSelectedRawgId(null);
    setRawgPage(1);
  };

  const loadMoreRawg = async () => {
    const nextPage = rawgPage + 1;
    setSearching(true);
    setError(null);
    const result = await searchWishlistRawg({ title: name, page: nextPage });
    setSearching(false);
    if (!result.success) {
      setError(result.error ?? "RAWG search failed");
      return;
    }
    const knownIds = new Set(candidates.map((candidate) => candidate.id));
    setCandidates((current) => [
      ...current,
      ...result.data.filter((candidate) => !knownIds.has(candidate.id)),
    ]);
    setRawgPage(nextPage);
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
      ...(entry.type === "DLC" && { baseGameId }),
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to update wishlist entry");
      return;
    }
    if (entry.type === "BASE_GAME" && selectedRawgId !== null) {
      const enrichment = await enrichWishlistEntryWithRawg({
        wishlistEntryId: entry.id,
        rawgId: selectedRawgId,
      });
      if (!enrichment.success) {
        toast.error(`Wishlist updated, but RAWG failed: ${enrichment.error}`);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit wishlist entry</DialogTitle>
          <DialogDescription>Update local wishlist details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`edit-wishlist-name-${entry.id}`}>
              {entry.type === "BASE_GAME" ? "Name and RAWG match" : "Name"}
            </Label>
            <div className="flex gap-2">
              <Input id={`edit-wishlist-name-${entry.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
              {entry.type === "BASE_GAME" && (
                <Button type="button" variant="outline" onClick={() => void searchRawg()} disabled={searching || !name.trim()}>
                  <Search />
                  {searching ? "Searching" : "Search"}
                </Button>
              )}
            </div>
          </div>
          {entry.type === "BASE_GAME" && candidates.length > 0 && (
            <div className="grid gap-2">
              <Label>RAWG selection</Label>
              {selectedRawgId !== null && (
                <div className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
                  <p className="font-medium">Selected RAWG match</p>
                  <p>{candidates.find((candidate) => candidate.id === selectedRawgId)?.name}</p>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setSelectedRawgId(null)}>
                    Clear selection
                  </Button>
                </div>
              )}
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border p-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${selectedRawgId === candidate.id ? "bg-muted" : ""}`}
                    onClick={() => {
                      setSelectedRawgId(candidate.id);
                      setName(candidate.name);
                    }}
                  >
                    {candidate.name}
                    {candidate.released ? ` (${candidate.released.slice(0, 4)})` : ""}
                  </button>
                ))}
                {candidates.length >= rawgPage * 5 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void loadMoreRawg()} disabled={searching}>
                    {searching ? "Loading..." : "Load more RAWG matches"}
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
          <DialogFooter><Button type="submit" disabled={submitting || (entry.type === "DLC" && !baseGameId)}>{submitting ? "Saving..." : "Save changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
