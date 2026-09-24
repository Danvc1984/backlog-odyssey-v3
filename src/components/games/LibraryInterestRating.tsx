"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePersonalFields } from "@/actions/game-detail";

export function LibraryInterestRating({
  gameId,
  gameName,
  interest,
}: {
  gameId: string;
  gameName: string;
  interest: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(interest ?? 0);
  const [pending, startTransition] = useTransition();

  const choose = (value: number | null) => {
    const previous = selected;
    setSelected(value ?? 0);
    startTransition(() => {
      void (async () => {
        const result = await updatePersonalFields(gameId, { interest: value });
        if (!result.success) {
          setSelected(previous);
          toast.error(result.error ?? "Failed to update Play priority");
          return;
        }
        toast.success(`Play priority ${value === null ? "cleared" : "updated"} for "${gameName}"`);
        router.refresh();
      })();
    });
  };

  return (
    <div className="flex items-center" role="radiogroup" aria-label={`Set Play priority for ${gameName}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={selected === value}
          aria-label={`${value} star${value === 1 ? "" : "s"} for Play priority`}
          disabled={pending}
          className="rounded-sm px-0.5 text-sm text-muted-foreground transition-colors hover:text-warning focus-visible:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:cursor-wait disabled:opacity-60"
          onClick={() => choose(value)}
        >
          <span aria-hidden="true" className={value <= selected ? "text-warning" : undefined}>
            {value <= selected ? "★" : "☆"}
          </span>
        </button>
      ))}
      {selected > 0 && (
        <button
          type="button"
          aria-label="Clear Play priority"
          disabled={pending}
          className="ml-1 rounded-sm px-1 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:cursor-wait disabled:opacity-60"
          onClick={() => choose(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
