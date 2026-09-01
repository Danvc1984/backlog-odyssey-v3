"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function ViewSwitch({
  view,
  label,
}: {
  view: "grid" | "list";
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchTo = (next: "grid" | "list") => {
    if (next === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "grid") {
      params.delete("view");
    } else {
      params.set("view", "list");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-lg border border-border bg-input p-1">
      {(["grid", "list"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={view === mode}
          onClick={() => switchTo(mode)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === mode
              ? "bg-card-alt text-signal-strong"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode === "grid" ? "Grid" : "List"}
        </button>
      ))}
    </div>
  );
}