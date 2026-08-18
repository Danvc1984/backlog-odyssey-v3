"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showCatalogActionToast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { executeDelete, previewDelete } from "@/actions/catalog-operations";
import { showCatalogOperationToast, useUndoOperation } from "./CatalogOperationToast";

interface DeletePreview {
  game: { id: string; name: string; type: string };
  baseGame: { id: string; name: string } | null;
  dlc: { id: string; name: string }[];
  relations: {
    externalIds: number;
    availability: number;
    collections: number;
    tags: number;
    metadataSnapshots: number;
    compatSnapshots: number;
    envCompat: number;
    wishlist: boolean;
  };
}

const RELATION_LABELS: [keyof DeletePreview["relations"], string][] = [
  ["externalIds", "external ID"],
  ["availability", "availability record"],
  ["collections", "collection"],
  ["tags", "tag"],
  ["metadataSnapshots", "metadata snapshot"],
  ["compatSnapshots", "compatibility report"],
  ["envCompat", "environment record"],
];

export function DeleteGameDialog({ gameId }: { gameId: string }) {
  const router = useRouter();
  const undo = useUndoOperation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await previewDelete({ gameId });
    setLoading(false);
    if (result.success) {
      setPreview(result.data);
      setDeleteError(null);
    } else {
      setLoadError(result.error ?? "Failed to load delete preview");
    }
  }, [gameId]);

  const handleDelete = async () => {
    if (!preview) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await executeDelete({ gameId });
    setDeleting(false);

    if (!result.success) {
      setDeleteError(result.error ?? "Failed to delete game");
      return;
    }

    showCatalogActionToast(result.data.operationId, `Deleted "${preview.game.name}"`);
    showCatalogOperationToast(
      {
        operationId: result.data.operationId,
        expiresAt: new Date(result.data.expiresAt),
      },
      () => void undo(result.data.operationId),
    );
    setOpen(false);
    router.push("/library");
  };

  const relationSummary = preview
    ? RELATION_LABELS.filter(([key]) => {
        const value = preview.relations[key];
        return typeof value === "number" ? value > 0 : value;
      })
        .map(([key, label]) => {
          const value = preview.relations[key];
          const count = typeof value === "number" ? value : 1;
          return `${count} ${label}${count === 1 ? "" : "s"}`;
        })
        .join(", ") || "no attached records"
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadPreview();
        else setPreview(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this game?</DialogTitle>
          <DialogDescription>
            This removes the game from your catalog. You can undo it shortly after.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {preview && (
          <div className="grid gap-3 text-sm">
            {preview.game.type === "BASE_GAME" ? (
              <>
                <p>
                  Deleting <span className="font-medium">{preview.game.name}</span> will
                  also delete:
                </p>
                {preview.dlc.length > 0 ? (
                  <ul className="list-inside list-disc">
                    {preview.dlc.map((dlc) => (
                      <li key={dlc.id}>{dlc.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No DLC are attached.</p>
                )}
                <p className="text-muted-foreground">
                  It will also remove {relationSummary}.
                </p>
              </>
            ) : (
              <p>
                {preview.baseGame ? (
                  <>
                    This is DLC for{" "}
                    <span className="font-medium">{preview.baseGame.name}</span>. Deleting
                    it leaves the base game untouched.
                  </>
                ) : (
                  <span>This is a standalone DLC record.</span>
                )}
              </p>
            )}
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={handleDelete} disabled={deleting || !preview}>
            {deleting ? "Deleting..." : "Delete game"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
