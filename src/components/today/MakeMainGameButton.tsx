"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updatePlayState } from "@/actions/game-detail";
import { Button } from "@/components/ui/button";

export function MakeMainGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const makeMain = async () => {
    setUpdating(true);
    const result = await updatePlayState(gameId, { isMainGame: true });
    setUpdating(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to set main game");
      return;
    }
    toast.success("Main game updated");
    router.refresh();
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void makeMain()} disabled={updating}>
      {updating ? "Making main..." : "Make main"}
    </Button>
  );
}
