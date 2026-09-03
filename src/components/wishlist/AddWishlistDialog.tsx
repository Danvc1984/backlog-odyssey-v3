"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { createWishlistEntry } from "@/actions/wishlist";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RawgSearchCandidate } from "@/lib/rawg-types";

interface AddWishlistDialogProps {
  baseGames: { id: string; name: string }[];
  initialType?: "BASE_GAME" | "DLC";
  initialBaseGameId?: string;
  triggerLabel?: string;
  triggerSize?: "default" | "lg";
}

export function AddWishlistDialog({
  baseGames,
  initialType = "BASE_GAME",
  initialBaseGameId = "",
  triggerLabel = "Add to wishlist",
  triggerSize = "default",
}: AddWishlistDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"BASE_GAME" | "DLC">(initialType);
  const [name, setName] = useState("");
  const [interest, setInterest] = useState("5");
  const [baseGameId, setBaseGameId] = useState(initialBaseGameId);
  const [candidates, setCandidates] = useState<RawgSearchCandidate[]>([]);
  const [selectedRawgId, setSelectedRawgId] = useState<number | null>(null);
  const [rawgPage, setRawgPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType(initialType);
    setName("");
    setInterest("5");
    setBaseGameId(initialBaseGameId);
    setCandidates([]);
    setSelectedRawgId(null);
    setRawgPage(1);
    setError(null);
  };

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
    const result = await createWishlistEntry({
      name,
      type,
      baseGameId: type === "DLC" ? baseGameId : undefined,
      interest: Number(interest),
    });

    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "Failed to create wishlist entry");
      return;
    }

    let metadataError: string | null = null;
    if (type === "BASE_GAME" && selectedRawgId !== null) {
      const enrichment = await enrichWishlistEntryWithRawg({
        wishlistEntryId: result.data.id,
        rawgId: selectedRawgId,
      });
      if (!enrichment.success) metadataError = enrichment.error;
    }

    setSubmitting(false);
    setOpen(false);
    reset();
    router.refresh();
    toast.success(`Added "${name}" to wishlist`);
    if (metadataError) toast.error(`Wishlist saved, but RAWG failed: ${metadataError}`);
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
        <Button size={triggerSize}>
          <Plus />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to wishlist</DialogTitle>
          <DialogDescription>Save a base game or a DLC for a catalog game.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="wishlist-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger id="wishlist-type" aria-label="Wishlist type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BASE_GAME">Base game</SelectItem>
                <SelectItem value="DLC">DLC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wishlist-name">Name and RAWG match</Label>
            <div className="flex gap-2">
              <Input id="wishlist-name" value={name} onChange={(event) => setName(event.target.value)} required />
              {type === "BASE_GAME" && (
                <Button type="button" variant="outline" onClick={() => void searchRawg()} disabled={searching || !name.trim()}>
                  <Search />
                  {searching ? "Searching" : "Search"}
                </Button>
              )}
            </div>
          </div>
          {type === "DLC" && (
            <div className="grid gap-2">
              <Label htmlFor="wishlist-parent">Base game</Label>
              <Select value={baseGameId} onValueChange={setBaseGameId}>
                <SelectTrigger id="wishlist-parent" aria-label="Wishlist base game">
                  <SelectValue placeholder="Choose a base game" />
                </SelectTrigger>
                <SelectContent>
                  {baseGames.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "BASE_GAME" && (
            <div className="grid gap-2">
              <Label>RAWG selection (optional)</Label>
              {selectedRawgId !== null && (
                <div className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
                  <p className="font-medium">Selected RAWG match</p>
                  <p>{candidates.find((candidate) => candidate.id === selectedRawgId)?.name}</p>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setSelectedRawgId(null)}>
                    Clear selection
                  </Button>
                </div>
              )}
              {candidates.length > 0 && (
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
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="wishlist-interest">Interest</Label>
            <Select value={interest} onValueChange={setInterest}>
              <SelectTrigger id="wishlist-interest" aria-label="Wishlist interest">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || (type === "DLC" && !baseGameId)}>
              {submitting ? "Saving..." : "Add to wishlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
