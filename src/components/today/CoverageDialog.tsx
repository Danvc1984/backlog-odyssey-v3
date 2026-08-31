"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CoverageTitle } from "@/lib/today-data-health";

interface CoverageDialogProps {
  label: string;
  basis: string;
  titles: readonly CoverageTitle[];
}

export function CoverageDialog({ label, basis, titles }: CoverageDialogProps) {
  const [visibleCount, setVisibleCount] = useState(10);
  const remaining = Math.max(titles.length - visibleCount, 0);

  return (
    <Dialog onOpenChange={(open) => open && setVisibleCount(10)}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={titles.length === 0}
          className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="font-medium">{titles.length}</span>{" "}{label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{basis}</DialogDescription>
        </DialogHeader>
        {titles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {titles.slice(0, visibleCount).map((title) => (
                <li key={title.id}>
                  <Link href={`/games/${title.id}`} className="text-sm hover:underline">
                    {title.name}
                  </Link>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <button
                type="button"
                className="w-fit rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => setVisibleCount((count) => count + 10)}
              >
                Show more ({remaining} remaining)
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
