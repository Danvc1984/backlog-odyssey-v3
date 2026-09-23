"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePersonalFields, updatePlayState } from "@/actions/game-detail";
import type { UpdatePlayStateInput } from "@/actions/game-detail";

type PlayStateData = {
  playState: string;
  completedBefore: boolean;
  isMainGame: boolean;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
};

type PlayStateValue = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

type ToggleKey =
  | "isMainGame"
  | "playSoon"
  | "replayCandidate"
  | "hidden"
  | "completedBefore"
  | "handheldSuitable";

const PLAY_STATE_OPTIONS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
];

const TOGGLES: { key: ToggleKey; label: string; description: string }[] = [
  { key: "isMainGame", label: "Main game", description: "Keep this voyage in the Today spotlight." },
  { key: "playSoon", label: "Play soon", description: "Raise this game when choosing what comes next." },
  { key: "replayCandidate", label: "Replay candidate", description: "Keep a completed game eligible for another run." },
  { key: "completedBefore", label: "Completed before", description: "Record prior completion without changing current state." },
  { key: "hidden", label: "Hidden from library", description: "Keep this game out of normal library browsing." },
  { key: "handheldSuitable", label: "Planned for my handheld", description: "Mark this as a game you plan to play on your handheld." },
];

export function PlayStateSection({
  gameId,
  libraryEntry,
}: {
  gameId: string;
  libraryEntry: (PlayStateData & { handheldSuitable: boolean | null }) | null;
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
    completedBefore: libraryEntry?.completedBefore === true,
    handheldSuitable: libraryEntry?.handheldSuitable === true,
  });

  if (!libraryEntry) {
    return <p className="text-sm text-muted-foreground">Not in library</p>;
  }

  const savePlayState = async (input: UpdatePlayStateInput) => {
    setSaving(true);
    setError(null);
    const result = await updatePlayState(gameId, input);
    setSaving(false);

    if (result.success) {
      toast.success("Play state updated");
      router.refresh();
      return true;
    }
    setError(result.error ?? "Failed to update play state");
    return false;
  };

  const saveHandheldPlan = async (planned: boolean) => {
    setSaving(true);
    setError(null);
    const result = await updatePersonalFields(gameId, {
      handheldSuitable: planned ? true : null,
    });
    setSaving(false);

    if (result.success) {
      toast.success("Personal data updated");
      router.refresh();
      return true;
    }
    setError(result.error ?? "Failed to update personal data");
    return false;
  };

  const changePlayState = (value: string) => {
    if (saving) return;
    const prev = values.playState;
    const next = value as PlayStateValue;
    setValues((v) => ({ ...v, playState: next }));
    void savePlayState({ playState: next }).then((ok) => {
      if (!ok) setValues((v) => ({ ...v, playState: prev }));
    });
  };

  const toggle = (key: ToggleKey) => {
    if (saving) return;
    const prev = values[key];
    const next = !prev;
    setValues((v) => ({ ...v, [key]: next }));
    const request = key === "handheldSuitable"
      ? saveHandheldPlan(next)
      : savePlayState({ [key]: next } as UpdatePlayStateInput);
    void request.then((ok) => {
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

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">Journey markers</legend>
        <p className="text-xs leading-5 text-muted-foreground">
          Shape how this game fits into your backlog without changing its current play state.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {TOGGLES.map((toggleOption) => (
            <label key={toggleOption.key} className="block cursor-pointer">
              <input
                type="checkbox"
                checked={values[toggleOption.key]}
                disabled={saving}
                onChange={() => toggle(toggleOption.key)}
                className="peer sr-only"
              />
              <span className="flex min-h-20 flex-col justify-between rounded-lg border border-border bg-card/60 p-2 transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50">
                <span>
                  <span className="block text-xs font-semibold sm:text-sm">{toggleOption.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{toggleOption.description}</span>
                </span>
                <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {values[toggleOption.key] ? "Marked" : "Not marked"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {saving && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleNotchIcon className="size-3 animate-spin" />
          Saving...
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
