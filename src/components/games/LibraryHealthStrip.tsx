"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { updatePlayState } from "@/actions/game-detail";
import type { TodayDataHealth } from "@/lib/today-data-health";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MainGamePick {
  id: string;
  name: string;
}

const NO_MAIN_GAME = "__none__";

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

function SuggestMainGame({
  candidates,
  onPick,
}: {
  candidates: readonly MainGamePick[];
  onPick: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const pick = async (id: string) => {
    setBusy(true);
    try {
      await onPick(id);
    } finally {
      setBusy(false);
    }
  };

  const [first, ...rest] = candidates;

  return (
    <div className="mt-1.5 space-y-2">
      {first && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void pick(first.id)}
          className="w-full truncate rounded-[8px] border border-signal/40 bg-signal/10 px-2 py-1.5 text-left text-sm font-medium text-signal-strong transition-colors hover:bg-signal/15 disabled:opacity-50"
          title={first.name}
        >
          Set main: {first.name}
        </button>
      )}
      {rest.length > 0 && (
        <ul className="space-y-1">
          {rest.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pick(game.id)}
                className="w-full truncate rounded-[8px] px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                title={game.name}
              >
                {game.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!changed) return;
    window.location.reload();
  }, [changed]);

  const setMainGame = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        if (id === NO_MAIN_GAME) {
          if (mainGame) {
            const result = await updatePlayState(mainGame.id, { isMainGame: false });
            if (!result.success) {
              toast.error(result.error ?? "Failed to clear main game");
            } else {
              toast.success("Main game cleared");
              setChanged(true);
            }
          }
          return;
        }
        const result = await updatePlayState(id, { isMainGame: true });
        if (!result.success) {
          toast.error(result.error ?? "Failed to set main game");
        } else {
          toast.success("Main game updated");
          setChanged(true);
        }
      } finally {
        setBusy(false);
      }
    },
    [mainGame],
  );

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
        {mainGame ? (
          <>
            <div className="mt-1.5">
              <Select
                value={mainGame.id}
                onValueChange={(next) => {
                  if (next === NO_MAIN_GAME) {
                    void setMainGame(NO_MAIN_GAME);
                  } else {
                    void setMainGame(next);
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-label="Main game" disabled={busy}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MAIN_GAME}>Clear main game</SelectItem>
                  {[mainGame, ...inProgress].map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">In the spotlight on Today</p>
          </>
        ) : inProgress.length > 0 ? (
          <>
            <SuggestMainGame
              candidates={inProgress}
              onPick={(id) => setMainGame(id)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Choose a game in progress to pin it on Today
            </p>
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