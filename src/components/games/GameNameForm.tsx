"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateGameName } from "@/actions/game-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GameNameForm({
  gameId,
  initialName,
}: {
  gameId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateGameName(gameId, { name });

    setSaving(false);
    if (result.success) {
      setName(result.data.name);
      toast.success("Game name saved");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save game name");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:max-w-xl">
      <Label htmlFor="game-name">Game name</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="game-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          required
        />
        <Button type="submit" disabled={saving} className="sm:shrink-0">
          {saving ? "Saving..." : "Save name"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
