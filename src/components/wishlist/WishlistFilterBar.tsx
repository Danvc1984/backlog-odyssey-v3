"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Popover } from "radix-ui";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const FILTER_KEYS = ["q", "type", "interest", "sort"] as const;

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
      params.delete("page");
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

  const resetFilters = () => {
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((key) => params.delete(key));
    params.delete("page");
    router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
  };

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Wishlist filters">
      <div className="w-full min-w-0 md:min-w-64 md:flex-1">
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
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            Filters
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" side="bottom" sideOffset={6} className="z-50 w-72 space-y-4 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-card">
            <div>
              <p className="technical-label mb-1.5 text-muted-foreground">Type</p>
              <Select value={searchParams.get("type") ?? "ALL"} onValueChange={(value) => update("type", value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start" className="w-56">
                  {TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="technical-label mb-1.5 text-muted-foreground">Interest</p>
              <Select value={searchParams.get("interest") ?? "ALL"} onValueChange={(value) => update("interest", value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start" className="w-56">
                  {INTEREST_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button type="button" aria-pressed={searchParams.get("sort") === "discount"} onClick={toggleDiscountSort} className={cn("w-full rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors", searchParams.get("sort") === "discount" ? "border-opportunity/40 bg-opportunity/10 text-opportunity-text" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>Biggest discount</button>
            {hasActiveFilters && <button type="button" onClick={resetFilters} className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Reset filters</button>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="hidden flex-wrap gap-1.5 md:flex" aria-label="Wishlist type filters">
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
      <div className="hidden flex-wrap gap-1.5 md:flex" aria-label="Wishlist interest filters">
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
          "hidden rounded-full border px-3 py-1 text-xs font-medium transition-colors md:inline-flex",
          searchParams.get("sort") === "discount"
            ? "border-opportunity/40 bg-opportunity/10 text-opportunity-text"
            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Biggest discount
      </button>
      <button
        type="button"
        onClick={resetFilters}
        disabled={!hasActiveFilters}
        className="hidden rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
      >
        Reset filters
      </button>
    </div>
  );
}
