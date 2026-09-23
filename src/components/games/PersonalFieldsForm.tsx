"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePersonalFields } from "@/actions/game-detail";
import { PERSONAL_FIELD_HELP } from "@/lib/personal-field-help";

type LibraryEntryData = {
  priority: string | null;
  interest: number | null;
  rating: number | null;
  gameExperience: string | null;
};

const PRIORITY_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const EXPERIENCE_OPTIONS = [
  { value: "PC_GAMING", label: "PC gaming" },
  { value: "MULTIPLAYER_COOP", label: "Multiplayer & co-op" },
  { value: "COUCH_GAMING", label: "Couch gaming" },
  { value: "ON_THE_GO", label: "On the go" },
];

export function PersonalFieldsForm({
  gameId,
  libraryEntry,
}: {
  gameId: string;
  libraryEntry: LibraryEntryData | null;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState(libraryEntry?.priority ?? "NONE");
  const [interest, setInterest] = useState(
    libraryEntry?.interest?.toString() ?? "",
  );
  const [rating, setRating] = useState(libraryEntry?.rating?.toString() ?? "");
  const [gameExperience, setGameExperience] = useState(
    libraryEntry?.gameExperience ?? "",
  );
  if (!libraryEntry) {
    return <p className="text-sm text-muted-foreground">Not in library</p>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updatePersonalFields(gameId, {
      priority: priority as "NONE" | "LOW" | "MEDIUM" | "HIGH",
      interest: interest === "" ? null : Number(interest),
      rating: rating === "" ? null : Number(rating),
      gameExperience: gameExperience === "" ? null : gameExperience as
        | "PC_GAMING"
        | "MULTIPLAYER_COOP"
        | "COUCH_GAMING"
        | "ON_THE_GO",
    });

    setSaving(false);

    if (result.success) {
      toast.success("Personal fields saved");
    } else {
      setError(result.error ?? "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="grid gap-2">
        <Label htmlFor="priority" className="flex items-center gap-1">
          Priority <InfoPopover label="Priority" content={PERSONAL_FIELD_HELP.priority} />
        </Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger id="priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="interest" className="flex items-center gap-1">
          Interest <span className="text-muted-foreground">(1-5)</span>
          <InfoPopover label="Interest" content={PERSONAL_FIELD_HELP.interest} />
        </Label>
        <Input
          id="interest"
          type="number"
          min={1}
          max={5}
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          placeholder="Leave blank to unset"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rating" className="flex items-center gap-1">
          Rating <span className="text-muted-foreground">(1-10)</span>
          <InfoPopover label="Rating" content={PERSONAL_FIELD_HELP.rating} />
        </Label>
        <Input
          id="rating"
          type="number"
          min={1}
          max={10}
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          placeholder="Leave blank to unset"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="game-experience" className="flex items-center gap-1">
          Game experience <InfoPopover label="Game experience" content={PERSONAL_FIELD_HELP.gameExperience} />
        </Label>
        <Select value={gameExperience} onValueChange={setGameExperience}>
          <SelectTrigger id="game-experience" className="w-full">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Not set</SelectItem>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      </div>

      <div className="flex justify-end border-t border-border pt-3">
        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
