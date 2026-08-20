"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, RotateCcw, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import {
  discardUnresolvedDlc,
  linkUnresolvedDlc,
  restoreUnresolvedDlc,
  resolveUnresolvedDlcWithNewBase,
} from "@/actions/unresolved-dlc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UnresolvedDlcStatus = "PENDING" | "DISCARDED";

interface UnresolvedDlcItem {
  id: string;
  steamAppId: string;
  name: string;
  steamBaseAppId: string | null;
  status: UnresolvedDlcStatus;
}

interface BaseGameOption {
  id: string;
  name: string;
}

interface UnresolvedDlcReviewCardProps {
  items: UnresolvedDlcItem[];
  baseGames: BaseGameOption[];
}

type DialogMode = "link" | "create" | null;

export function UnresolvedDlcReviewCard({
  items,
  baseGames,
}: UnresolvedDlcReviewCardProps) {
  const router = useRouter();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedItem, setSelectedItem] = useState<UnresolvedDlcItem | null>(null);
  const [search, setSearch] = useState("");
  const [baseName, setBaseName] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingItems = items.filter((item) => item.status === "PENDING");
  const discardedItems = items.filter((item) => item.status === "DISCARDED");
  const matchingBaseGames = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return baseGames
      .filter((game) => game.name.toLocaleLowerCase().includes(normalizedSearch))
      .slice(0, 8);
  }, [baseGames, search]);

  const openLinkDialog = (item: UnresolvedDlcItem) => {
    setSelectedItem(item);
    setDialogMode("link");
    setSearch("");
    setError(null);
  };

  const openCreateDialog = (item: UnresolvedDlcItem) => {
    setSelectedItem(item);
    setDialogMode("create");
    setBaseName(item.name);
    setError(null);
  };

  const closeDialog = () => {
    if (workingId) return;
    setDialogMode(null);
    setSelectedItem(null);
    setError(null);
  };

  const linkItem = async (targetBaseGameId: string) => {
    if (!selectedItem) return;
    setWorkingId(selectedItem.id);
    setError(null);
    const result = await linkUnresolvedDlc({
      unresolvedId: selectedItem.id,
      targetBaseGameId,
    });
    setWorkingId(null);
    if (!result.success) {
      setError(result.error ?? "Failed to link DLC");
      return;
    }
    toast.success(`Linked "${selectedItem.name}"`);
    closeDialog();
    router.refresh();
  };

  const createBaseAndDlc = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) return;
    setWorkingId(selectedItem.id);
    setError(null);
    const result = await resolveUnresolvedDlcWithNewBase({
      unresolvedId: selectedItem.id,
      baseGameName: baseName,
    });
    setWorkingId(null);
    if (!result.success) {
      setError(result.error ?? "Failed to create base game and DLC");
      return;
    }
    toast.success(`Created base game and DLC for "${selectedItem.name}"`);
    closeDialog();
    router.refresh();
  };

  const updateStatus = async (item: UnresolvedDlcItem, status: "DISCARD" | "RESTORE") => {
    setWorkingId(item.id);
    const result = status === "DISCARD"
      ? await discardUnresolvedDlc({ unresolvedId: item.id })
      : await restoreUnresolvedDlc({ unresolvedId: item.id });
    setWorkingId(null);
    if (!result.success) {
      setError(result.error ?? "Failed to update DLC review status");
      return;
    }
    toast.success(status === "DISCARD" ? "DLC discarded" : "DLC restored to review");
    router.refresh();
  };

  return (
    <section className="mt-6 rounded-lg border border-border p-4" aria-labelledby="unresolved-dlc-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="unresolved-dlc-heading" className="text-sm font-medium">
            Unresolved Steam DLC
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review owned DLC whose base game is not in the catalog.
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
          {pendingItems.length} pending
        </span>
      </div>

      {pendingItems.length === 0 && discardedItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No unresolved Steam DLC.</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {pendingItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Steam DLC {item.steamAppId}
                    {item.steamBaseAppId ? ` · base ${item.steamBaseAppId}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openLinkDialog(item)}>
                    <Link2 />
                    Link base game
                  </Button>
                  <Button type="button" size="sm" onClick={() => openCreateDialog(item)}>
                    <WandSparkles />
                    Create base + DLC
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={workingId === item.id}
                    onClick={() => void updateStatus(item, "DISCARD")}
                  >
                    <Trash2 />
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {discardedItems.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium">Discarded</h3>
              <ul className="mt-2 grid gap-2">
                {discardedItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span>{item.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={workingId === item.id}
                      onClick={() => void updateStatus(item, "RESTORE")}
                    >
                      <RotateCcw />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {dialogMode === "link" && selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>Link {selectedItem.name}</DialogTitle>
                <DialogDescription>Search for the existing base game this DLC belongs to.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <Label htmlFor="base-game-search">Base game</Label>
                <Input
                  id="base-game-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search base games..."
                  autoFocus
                />
                <div className="grid max-h-56 gap-1 overflow-y-auto">
                  {matchingBaseGames.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No base games match.</p>
                  ) : (
                    matchingBaseGames.map((game) => (
                      <Button
                        key={game.id}
                        type="button"
                        variant="ghost"
                        className="justify-start"
                        disabled={workingId === selectedItem.id}
                        onClick={() => void linkItem(game.id)}
                      >
                        <Check />
                        {game.name}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {dialogMode === "create" && selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>Create base game and DLC</DialogTitle>
                <DialogDescription>
                  This creates both catalog records and removes the review item in one transaction.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createBaseAndDlc} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-base-name">Base game name</Label>
                  <Input
                    id="new-base-name"
                    value={baseName}
                    onChange={(event) => setBaseName(event.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={workingId === selectedItem.id}>
                    {workingId === selectedItem.id ? "Creating..." : "Create base + DLC"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
