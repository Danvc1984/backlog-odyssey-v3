"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface ViewMode {
  value: string;
  label: string;
}

const DEFAULT_MODES: ViewMode[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

export function ViewSwitch({
  view,
  label,
  modes = DEFAULT_MODES,
}: {
  view: string;
  label: string;
  modes?: readonly ViewMode[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchTo = (next: string) => {
    if (next === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === modes[0]?.value) {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-lg border border-border bg-input p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={view === mode.value}
          onClick={() => switchTo(mode.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === mode.value
              ? "bg-card-alt text-signal-strong"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
