"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateWishlistEntry } from "@/actions/wishlist";

export function WishlistInterestRating({
  entryId,
  entryName,
  interest,
}: {
  entryId: string;
  entryName: string;
  interest: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(interest ?? 0);
  const [pending, startTransition] = useTransition();

  const choose = (value: number) => {
    const previous = selected;
    setSelected(value);
    startTransition(() => {
      void (async () => {
        const result = await updateWishlistEntry({ id: entryId, interest: value });
        if (!result.success) {
          setSelected(previous);
          toast.error(result.error ?? "Failed to update interest");
          return;
        }
        toast.success(`Interest updated for "${entryName}"`);
        router.refresh();
      })();
    });
  };

  return (
    <div className="flex items-center" role="radiogroup" aria-label={`Set interest for ${entryName}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={selected === value}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          disabled={pending}
          className="rounded-sm px-0.5 text-sm text-muted-foreground transition-colors hover:text-warning focus-visible:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:cursor-wait disabled:opacity-60"
          onClick={() => choose(value)}
        >
          <span aria-hidden="true" className={value <= selected ? "text-warning" : undefined}>
            {value <= selected ? "★" : "☆"}
          </span>
        </button>
      ))}
    </div>
  );
}
