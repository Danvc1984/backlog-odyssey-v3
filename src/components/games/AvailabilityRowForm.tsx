"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateGameAvailability } from "@/actions/game-detail";
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

type AvailabilitySource = "STEAM" | "OTHER_PLATFORM" | "ROM";

const SOURCE_LABELS: Record<AvailabilitySource, string> = {
  STEAM: "Steam",
  OTHER_PLATFORM: "Other platform",
  ROM: "ROM",
};

export function AvailabilityRowForm({
  availabilityId,
  source,
  displayName,
}: {
  availabilityId: string;
  source: AvailabilitySource;
  displayName: string | null;
}) {
  const router = useRouter();
  const [selectedSource, setSelectedSource] = useState(source);
  const [selectedDisplayName, setSelectedDisplayName] = useState(
    displayName ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateGameAvailability(availabilityId, {
      source: selectedSource,
      displayName: selectedDisplayName,
    });

    setSaving(false);
    if (result.success) {
      setSelectedSource(result.data.source);
      setSelectedDisplayName(result.data.displayName ?? "");
      toast.success("Availability saved");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save availability");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4">
      <div className="grid gap-2">
        <Label htmlFor={`availability-source-${availabilityId}`}>Source</Label>
        <Select
          value={selectedSource}
          onValueChange={(value) =>
            setSelectedSource(value as AvailabilitySource)
          }
        >
          <SelectTrigger
            id={`availability-source-${availabilityId}`}
            className="w-full"
            disabled={saving}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`availability-name-${availabilityId}`}>
          Display name
        </Label>
        <Input
          id={`availability-name-${availabilityId}`}
          value={selectedDisplayName}
          onChange={(event) => setSelectedDisplayName(event.target.value)}
          disabled={saving}
          placeholder="Optional platform-specific name"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save availability"}
      </Button>
    </form>
  );
}
