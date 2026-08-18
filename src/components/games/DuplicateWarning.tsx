"use client";

import Link from "next/link";
import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";

export function DuplicateWarning({ otherGameName }: { otherGameName: string }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <p className="flex-1">
        This game may be a duplicate of{" "}
        <Link
          href="/library?duplicates=true"
          className="font-medium underline underline-offset-2"
        >
          {otherGameName}
        </Link>
        . Review the possible duplicate before changing either game.
      </p>
      <button
        type="button"
        aria-label="Dismiss duplicate warning"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-amber-500/10 hover:text-foreground"
        onClick={() => setVisible(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
