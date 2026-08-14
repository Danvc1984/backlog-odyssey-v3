"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type LibraryEntryData = {
  priority: string | null;
  interest: number | null;
  rating: number | null;
  preferredEnvironment: string | null;
  notes: string | null;
};

const PRIORITY_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const ENV_OPTIONS = [
  { value: "BAZZITE", label: "Bazzite" },
  { value: "STEAM_DECK", label: "Steam Deck" },
  { value: "WINDOWS", label: "Windows" },
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
  const [preferredEnvironment, setPreferredEnvironment] = useState(
    libraryEntry?.preferredEnvironment ?? "",
  );
  const [notes, setNotes] = useState(libraryEntry?.notes ?? "");

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
      preferredEnvironment:
        preferredEnvironment === ""
          ? null
          : (preferredEnvironment as "BAZZITE" | "STEAM_DECK" | "WINDOWS"),
      notes: notes === "" ? null : notes,
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
      <div className="grid gap-2">
        <Label htmlFor="priority">Priority</Label>
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
        <Label htmlFor="interest">
          Interest <span className="text-muted-foreground">(1-5)</span>
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
        <Label htmlFor="rating">
          Rating <span className="text-muted-foreground">(1-10)</span>
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
        <Label htmlFor="env">Preferred environment</Label>
        <Select
          value={preferredEnvironment}
          onValueChange={setPreferredEnvironment}
        >
          <SelectTrigger id="env" className="w-full">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Not set</SelectItem>
            {ENV_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this game..."
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}