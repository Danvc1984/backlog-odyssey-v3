"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
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
    <article className={`rounded-lg border p-3 md:p-4 ${TILE_CLASSES[kind]}`}>
      <div className="technical-label text-muted-foreground">{eyebrow}</div>
      <div className="mt-1 text-xl font-bold tracking-tight md:mt-1.5 md:text-2xl">{value}</div>
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
        <Button type="button" variant="secondary" className="mt-1 w-full justify-between text-xs md:mt-1.5 md:text-sm" disabled={busy}>
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
  const router = useRouter();
  const setMainGame = useCallback(
    async (id: string) => {
      const result = await updatePlayState(id, { isMainGame: true });
      if (!result.success) {
        toast.error(result.error ?? "Failed to set main game");
        return false;
      } else {
        toast.success("Main game updated");
        router.refresh();
        return true;
      }
    },
    [router],
  );

  const clearMainGame = useCallback(async (id: string) => {
    const result = await updatePlayState(id, { isMainGame: false });
    if (!result.success) {
      toast.error(result.error ?? "Failed to clear main game");
      return false;
    }
    toast.success("Main game cleared");
    router.refresh();
    return true;
  }, [router]);

  const inProgress = games.filter((game) => game.id !== mainGame?.id);

  const tiles = (
    <>
      <Tile
        kind="signal"
        eyebrow="Backlog progress"
        value={`${health.activeBacklog.completed} / ${health.activeBacklog.total}`}
        detail="played through"
      />
      <Tile
        kind="warning"
        eyebrow="Provider metadata"
        value={health.igdbMetadata.missing.length}
        detail="games missing IGDB coverage"
      />
      <Tile
        kind="opportunity"
        eyebrow="Personalization"
        value={health.recommendationProfile.incomplete.length}
        detail="games in need of personalization"
      />
      <article className="rounded-lg border border-signal/60 bg-signal/10 p-3 md:p-4">
        <div className="technical-label text-muted-foreground">Main game</div>
        {mainGame || inProgress.length > 0 ? (
          <>
            <MainGamePicker
              mainGame={mainGame}
              candidates={[...(mainGame ? [mainGame] : []), ...inProgress]}
              onPick={(id) => setMainGame(id)}
              onClear={(id) => clearMainGame(id)}
            />
            <p className="mt-1 text-xs text-muted-foreground">In the spotlight</p>
          </>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Mark a game as in progress on its detail page to pin it here
          </p>
        )}
      </article>
    </>
  );

  return (
    <>
      <details className="group rounded-lg border border-border bg-card md:hidden">
        <summary className="cursor-pointer p-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30 md:p-4 md:text-base">
          <span className="ml-2">Library health</span>
          <span className="ml-2 text-xs text-muted-foreground">
            Backlog {health.activeBacklog.completed} / {health.activeBacklog.total}
          </span>
        </summary>
        <div className="grid gap-2 border-t border-border p-3 md:gap-3 md:p-4">{tiles}</div>
      </details>
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">{tiles}</div>
    </>
  );
}
