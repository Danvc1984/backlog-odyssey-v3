"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { updatePlayState } from "@/actions/game-detail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TodayDataHealth } from "@/lib/today-data-health";

export interface MainGamePick {
  id: string;
  name: string;
}

const TILE_CLASSES = {
  signal: "border-signal/40 bg-signal/5",
  warning: "border-warning/40 bg-warning/5",
  opportunity: "border-opportunity/40 bg-opportunity/5",
  neutral: "border-border bg-card",
} as const;

function Tile({
  kind,
  eyebrow,
  value,
  detail,
}: {
  kind: keyof typeof TILE_CLASSES;
  eyebrow: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <article className={`rounded-lg border p-4 ${TILE_CLASSES[kind]}`}>
      <div className="technical-label text-muted-foreground">{eyebrow}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function MainGamePicker({
  mainGame,
  candidates,
  onPick,
  onClear,
}: {
  mainGame: MainGamePick | null;
  candidates: readonly MainGamePick[];
  onPick: (id: string) => Promise<boolean>;
  onClear: (id: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedGame, setSelectedGame] = useState(mainGame);

  const choose = async (game: MainGamePick | null, action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      if (await action()) {
        setSelectedGame(game);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" className="mt-1.5 w-full justify-between" disabled={busy}>
          <span className="truncate">{selectedGame?.name ?? "Choose main game"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose main game</DialogTitle>
          <DialogDescription>
            Select the game to keep in the spotlight on Today.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {mainGame && (
            <Button
              type="button"
              variant="secondary"
              className="justify-start"
              disabled={busy}
              onClick={() => void choose(null, () => onClear(selectedGame?.id ?? ""))}
            >
              Clear main game
            </Button>
          )}
          {candidates.map((game) => (
            <Button
              key={game.id}
              type="button"
              variant={game.id === selectedGame?.id ? "default" : "secondary"}
              className="justify-start"
              disabled={busy}
              onClick={() => void choose(game, () => onPick(game.id))}
            >
              {game.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LibraryHealthStrip({
  health,
  games,
  mainGame,
}: {
  health: TodayDataHealth;
  games: readonly MainGamePick[];
  mainGame: MainGamePick | null;
}) {
  const setMainGame = useCallback(
    async (id: string) => {
      const result = await updatePlayState(id, { isMainGame: true });
      if (!result.success) {
        toast.error(result.error ?? "Failed to set main game");
        return false;
      } else {
        toast.success("Main game updated");
        return true;
      }
    },
    [],
  );

  const clearMainGame = useCallback(async (id: string) => {
    const result = await updatePlayState(id, { isMainGame: false });
    if (!result.success) {
      toast.error(result.error ?? "Failed to clear main game");
      return false;
    }
    toast.success("Main game cleared");
    return true;
  }, []);

  const inProgress = games.filter((game) => game.id !== mainGame?.id);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        kind="signal"
        eyebrow="Backlog progress"
        value={`${health.activeBacklog.playedBefore} / ${health.activeBacklog.total}`}
        detail={`played through · ${health.abandoned} abandoned`}
      />
      <Tile
        kind="warning"
        eyebrow="Provider metadata"
        value={health.rawgMetadata.missing.length}
        detail="games missing RAWG coverage"
      />
      <Tile
        kind="opportunity"
        eyebrow="Personal profile"
        value={health.recommendationProfile.incomplete.length}
        detail="games need one more signal"
      />
      <article className={`rounded-lg border p-4 ${TILE_CLASSES.neutral}`}>
        <div className="technical-label text-muted-foreground">Main game</div>
        {mainGame || inProgress.length > 0 ? (
          <>
            <MainGamePicker
              mainGame={mainGame}
              candidates={[...(mainGame ? [mainGame] : []), ...inProgress]}
              onPick={(id) => setMainGame(id)}
              onClear={(id) => clearMainGame(id)}
            />
            <p className="mt-1 text-xs text-muted-foreground">In the spotlight on Today</p>
          </>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Mark a game as in progress on its detail page to pin it here
          </p>
        )}
      </article>
    </div>
  );
}
