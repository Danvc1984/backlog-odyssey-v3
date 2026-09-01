"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveTasteSetup } from "@/actions/recommendations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TasteAnswer = "PLAYED" | "LIKED" | "SKIPPED";

interface TasteSetupGame {
  id: string;
  name: string;
}

interface TasteSetupPick {
  id: string;
  name: string;
  answer: TasteAnswer | null;
}

interface TasteSetupPanelProps {
  games: TasteSetupGame[];
  initialPicks: TasteSetupGame[];
}

const ANSWERS: { value: TasteAnswer; label: string }[] = [
  { value: "PLAYED", label: "Played it" },
  { value: "LIKED", label: "I like this" },
  { value: "SKIPPED", label: "Skip" },
];

const EXPERIENCE_OPTIONS = [
  ["PC_GAMING", "PC gaming"],
  ["MULTIPLAYER_COOP", "Multiplayer co-op"],
  ["COUCH_GAMING", "Couch gaming"],
  ["ON_THE_GO", "On the go"],
] as const;

const ENVIRONMENT_OPTIONS = [
  ["BAZZITE", "Bazzite"],
  ["STEAM_DECK", "Steam Deck"],
  ["WINDOWS", "Windows"],
] as const;

function initialPickState(games: TasteSetupGame[]): TasteSetupPick[] {
  return games.map((game) => ({ ...game, answer: null }));
}

export function TasteSetupPanel({ games, initialPicks }: TasteSetupPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [picks, setPicks] = useState(() => initialPickState(initialPicks));
  const [experience, setExperience] = useState("");
  const [environment, setEnvironment] = useState("");
  const [saving, setSaving] = useState(false);

  if (dismissed) return null;

  const answeredCount = picks.filter((pick) => pick.answer !== null).length;

  const replacePick = (index: number, id: string) => {
    const game = games.find((candidate) => candidate.id === id);
    if (!game) return;
    setPicks((current) => current.map((pick, pickIndex) => pickIndex === index ? { ...game, answer: null } : pick));
  };

  const setAnswer = (index: number, answer: TasteAnswer) => {
    setPicks((current) => current.map((pick, pickIndex) => pickIndex === index ? { ...pick, answer } : pick));
  };

  const save = async () => {
    setSaving(true);
    const result = await saveTasteSetup({
      picks: picks.map(({ id, answer }) => ({ gameId: id, answer })),
      experience: experience || null,
      environment: environment || null,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not save taste setup");
      return;
    }
    setOpen(false);
    toast.success(`Taste setup saved for ${answeredCount} game${answeredCount === 1 ? "" : "s"}`);
    router.refresh();
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((current) => !current)} className="flex min-w-0 items-center gap-2 text-left">
          <span className="text-sm font-medium">Set up your taste</span>
          <span className="text-xs text-muted-foreground">{open ? "Collapse" : "Open"}</span>
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Not now
        </button>
      </div>
      {open && (
        <div className="border-t border-border p-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pick a few games to give your recommendations a starting point. You can swap any game before saving.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {picks.map((pick, index) => (
              <div key={`${pick.id}-${index}`} className="rounded-lg border border-border bg-background p-3">
                <Select value={pick.id} onValueChange={(value) => replacePick(index, value)}>
                  <SelectTrigger aria-label={`Game ${index + 1}`} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id} disabled={picks.some((other, otherIndex) => otherIndex !== index && other.id === game.id)}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ANSWERS.map((answer) => (
                    <button
                      key={answer.value}
                      type="button"
                      aria-pressed={pick.answer === answer.value}
                      onClick={() => setAnswer(index, answer.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${pick.answer === answer.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {answer.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Game experience (optional)
              <Select value={experience || "NONE"} onValueChange={(value) => setExperience(value === "NONE" ? "" : value)}>
                <SelectTrigger aria-label="Game experience" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NONE">No preference</SelectItem>{EXPERIENCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Preferred environment (optional)
              <Select value={environment || "NONE"} onValueChange={(value) => setEnvironment(value === "NONE" ? "" : value)}>
                <SelectTrigger aria-label="Preferred environment" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NONE">No preference</SelectItem>{ENVIRONMENT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{answeredCount} of {picks.length} answered</span>
            <button type="button" onClick={() => void save()} disabled={saving || answeredCount === 0} className="rounded-md bg-foreground px-3 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save taste setup"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
