"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateGameAvailability } from "@/actions/game-detail";
import { Button } from "@/components/ui/button";
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
}: {
  availabilityId: string;
  source: AvailabilitySource;
}) {
  const router = useRouter();
  const [selectedSource, setSelectedSource] = useState(source);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateGameAvailability(availabilityId, {
      source: selectedSource,
    });

    setSaving(false);
    if (result.success) {
      setSelectedSource(result.data.source);
      toast.success("Availability saved");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save availability");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4">
      <div className="grid gap-2">
        <Label htmlFor={`availability-source-${availabilityId}`}>Platform</Label>
        <Select
          value={selectedSource}
          onValueChange={(value) => setSelectedSource(value as AvailabilitySource)}
        >
          <SelectTrigger id={`availability-source-${availabilityId}`} className="w-full" disabled={saving}>
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save platform"}
      </Button>
    </form>
  );
}
