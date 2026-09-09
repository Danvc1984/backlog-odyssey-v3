"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "ALL", label: "All wishes" },
  { value: "BASE_GAME", label: "Base games" },
  { value: "DLC", label: "DLC" },
];

const INTEREST_OPTIONS = [
  { value: "ALL", label: "Any interest" },
  ...[5, 4, 3, 2, 1].map((value) => ({
    value: String(value),
    label: `${value} star${value === 1 ? "" : "s"}`,
  })),
];

export function WishlistFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "ALL") params.delete(key);
      else params.set(key, value);
      router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
    },
    [pathname, router, searchParams],
  );

  const toggleDiscountSort = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchParams.get("sort") === "discount") params.delete("sort");
    else params.set("sort", "discount");
    params.delete("page");
    router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Wishlist filters">
      <div className="min-w-64 flex-1">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            update("q", value.trim());
          }}
          placeholder="Search games and DLC"
          aria-label="Search wishlist"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Wishlist type filters">
        {TYPE_OPTIONS.map((option) => {
          const active = (searchParams.get("type") ?? "ALL") === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => update("type", option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-signal/40 bg-signal/10 text-signal-strong"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Wishlist interest filters">
        {INTEREST_OPTIONS.map((option) => {
          const active = (searchParams.get("interest") ?? "ALL") === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => update("interest", option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-signal/40 bg-signal/10 text-signal-strong"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={searchParams.get("sort") === "discount"}
        onClick={toggleDiscountSort}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          searchParams.get("sort") === "discount"
            ? "border-opportunity/40 bg-opportunity/10 text-opportunity-text"
            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Biggest discount
      </button>
    </div>
  );
}
