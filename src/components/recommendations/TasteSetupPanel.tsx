"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveTasteSetup } from "@/actions/recommendations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectRandomUnselectedItem } from "@/lib/recommendations/taste-setup";

interface TasteSetupGame {
  id: string;
  name: string;
  completedBefore?: boolean;
}

interface TasteSetupPick extends TasteSetupGame {
  completedBefore: boolean;
  recommendMore: boolean;
  playSoon: boolean;
}

interface TasteSetupPanelProps {
  games: TasteSetupGame[];
  initialPicks: TasteSetupGame[];
}

const EXPERIENCE_OPTIONS = [
  ["PC_GAMING", "PC gaming"],
  ["MULTIPLAYER_COOP", "Multiplayer co-op"],
  ["COUCH_GAMING", "Couch gaming"],
  ["ON_THE_GO", "On the go"],
] as const;

const SIGNALS = [
  ["completedBefore", "Played before"],
  ["recommendMore", "Recommend more like this"],
  ["playSoon", "Would like to play soon"],
] as const;

type SignalKey = (typeof SIGNALS)[number][0];

function initialPickState(games: TasteSetupGame[]): TasteSetupPick[] {
  return games.map((game) => ({
    ...game,
    completedBefore: game.completedBefore ?? false,
    recommendMore: false,
    playSoon: false,
  }));
}

export function TasteSetupPanel({ games, initialPicks }: TasteSetupPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [picks, setPicks] = useState(() => initialPickState(initialPicks));
  const [experience, setExperience] = useState("");
  const [saving, setSaving] = useState(false);

  if (dismissed) return null;

  const meaningfulCount = picks.filter((pick) => pick.completedBefore || pick.recommendMore || pick.playSoon).length;

  const replacePick = (index: number) => {
    const usedIds = new Set(picks.map((pick) => pick.id));
    const replacement = selectRandomUnselectedItem(games, usedIds);
    if (!replacement) return;
    setPicks((current) => current.map((pick, pickIndex) => pickIndex === index ? {
      ...replacement,
      completedBefore: replacement.completedBefore ?? false,
      recommendMore: false,
      playSoon: false,
    } : pick));
  };

  const toggleSignal = (index: number, signal: SignalKey) => {
    setPicks((current) => current.map((pick, pickIndex) => pickIndex === index ? { ...pick, [signal]: !pick[signal] } : pick));
  };

  const save = async () => {
    setSaving(true);
    const result = await saveTasteSetup({
      picks: picks.map(({ id, completedBefore, recommendMore, playSoon }) => ({ gameId: id, completedBefore, recommendMore, playSoon })),
      experience: experience || null,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not save taste setup");
      return;
    }
    setOpen(false);
    toast.success("Taste setup saved");
    router.refresh();
  };

  return (
    <section id="taste-setup" className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((current) => !current)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open} aria-controls="taste-setup-content">
          <span className="text-sm font-medium">Set up your taste</span>
          <span className="text-xs text-muted-foreground">{open ? "Collapse" : "Open"}</span>
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Not now
        </button>
      </div>
      {open && (
        <div id="taste-setup-content" className="border-t border-border p-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Help us understand your taste in games by selecting a few games from your library and providing some insight about them.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {picks.map((pick, index) => (
              <div key={`${pick.id}-${index}`} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium">{pick.name}</h3>
                  <button
                    type="button"
                    onClick={() => replacePick(index)}
                    disabled={games.length <= picks.length}
                    className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Pick another game for ${pick.name}`}
                  >
                    Pick another
                  </button>
                </div>
                <div className="mt-3 grid gap-1.5" role="group" aria-label={`Taste signals for ${pick.name}`}>
                  {SIGNALS.map(([key, label]) => {
                    const selected = pick[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${label}: ${selected ? "selected" : "not selected"} for ${pick.name}`}
                        onClick={() => toggleSignal(index, key)}
                        className={`min-h-10 rounded-md border px-3 py-2 text-left text-xs transition-colors ${selected ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {label}
                        <span className="ml-2 opacity-75">{selected ? "Selected" : "Not selected"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Game experience (optional)
              <Select value={experience || "NONE"} onValueChange={(value) => setExperience(value === "NONE" ? "" : value)}>
                <SelectTrigger aria-label="Game experience" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NONE">No preference</SelectItem>{EXPERIENCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{meaningfulCount} of {picks.length} with a signal</span>
            <button type="button" onClick={() => void save()} disabled={saving || meaningfulCount === 0} className="rounded-md bg-foreground px-3 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save taste setup"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
