"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlayState } from "@/actions/game-detail";
import type { UpdatePlayStateInput } from "@/actions/game-detail";

type PlayStateData = {
  playState: string;
  isMainGame: boolean;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
};

type PlayStateValue = "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED";

type ToggleKey = "isMainGame" | "playSoon" | "replayCandidate" | "hidden";

const PLAY_STATE_OPTIONS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PLAYED_BEFORE", label: "Played before" },
  { value: "ABANDONED", label: "Abandoned" },
];

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "isMainGame", label: "Main game" },
  { key: "playSoon", label: "Play soon" },
  { key: "replayCandidate", label: "Replay candidate" },
  { key: "hidden", label: "Hidden" },
];

export function PlayStateSection({
  gameId,
  libraryEntry,
}: {
  gameId: string;
  libraryEntry: PlayStateData | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    playState: (libraryEntry?.playState ?? "NOT_STARTED") as PlayStateValue,
    isMainGame: libraryEntry?.isMainGame ?? false,
    playSoon: libraryEntry?.playSoon ?? false,
    replayCandidate: libraryEntry?.replayCandidate ?? false,
    hidden: libraryEntry?.hidden ?? false,
  });

  if (!libraryEntry) {
    return <p className="text-sm text-muted-foreground">Not in library</p>;
  }

  const save = async (input: UpdatePlayStateInput) => {
    setSaving(true);
    setError(null);
    const result = await updatePlayState(gameId, input);
    setSaving(false);

    if (result.success) {
      toast.success("Play state updated");
      if (
        input.isMainGame !== undefined ||
        input.playState !== undefined ||
        input.hidden !== undefined
      ) {
        router.refresh();
      }
      return true;
    }
    setError(result.error ?? "Failed to update play state");
    return false;
  };

  const changePlayState = (value: string) => {
    if (saving) return;
    const prev = values.playState;
    const next = value as PlayStateValue;
    setValues((v) => ({ ...v, playState: next }));
    void save({ playState: next }).then((ok) => {
      if (!ok) setValues((v) => ({ ...v, playState: prev }));
    });
  };

  const toggle = (key: ToggleKey) => {
    if (saving) return;
    const prev = values[key];
    const next = !prev;
    setValues((v) => ({ ...v, [key]: next }));
    void save({ [key]: next }).then((ok) => {
      if (!ok) setValues((v) => ({ ...v, [key]: prev }));
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="play-state">Play state</Label>
        <Select
          value={values.playState}
          onValueChange={changePlayState}
          disabled={saving}
        >
          <SelectTrigger id="play-state" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAY_STATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {TOGGLES.map((t) => (
          <Label
            key={t.key}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <input
              type="checkbox"
              checked={values[t.key]}
              disabled={saving}
              onChange={() => toggle(t.key)}
              className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            {t.label}
          </Label>
        ))}
      </div>

      {saving && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
