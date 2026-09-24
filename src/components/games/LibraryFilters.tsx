"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Popover } from "radix-ui";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOURCE_OPTIONS = [
  { value: "ALL", label: "All sources" },
  { value: "STEAM", label: "Steam" },
  { value: "OTHER_PLATFORM", label: "All alternatives" },
  { value: "ROM", label: "ROM" },
];

const STATE_CHIPS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];

const STATE_OPTIONS = [
  { value: "ALL", label: "All states" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export type FilterCollection = {
  id: string;
  name: string;
  isSystem: boolean;
};

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-signal/40 bg-signal/10 text-signal-strong"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function LibraryFilters({
  collections,
  alternativeSources,
}: {
  collections: FilterCollection[];
  alternativeSources: { id: string; name: string; iconName: string; brandIcon?: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const q = searchParams.get("q") ?? "";
  const source = searchParams.get("source") ?? "ALL";
  const state = searchParams.get("state") ?? "ALL";
  const sort = searchParams.get("sort") ?? "newest";
  const collection = searchParams.get("collection") ?? "ALL";
  const alternativeSource = searchParams.get("alt");
  const handheldParam = searchParams.get("handheld");
  const handheld = handheldParam === "marked" || handheldParam === "unmarked"
    ? handheldParam
    : "ALL";
  const hasDlc = searchParams.get("hasDlc") === "true";

  const systemCollections = collections.filter((c) => c.isSystem);
  const personalTagCollections = collections.filter((c) => !c.isSystem);

  const toggleState = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (state === value) {
        params.delete("state");
      } else {
        params.set("state", value);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, state],
  );

  const updateSource = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("alt");
    if (value.startsWith("alt:")) {
      params.delete("source");
      params.set("alt", value.slice(4));
    } else if (!value || value === "ALL") {
      params.delete("source");
    } else {
      params.set("source", value);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const hasHiddenFilters =
    alternativeSource !== null ||
    source !== "ALL" ||
    state !== "ALL" ||
    sort !== "newest" ||
    (collection !== null && collection !== "ALL") ||
    handheld !== "ALL" ||
    hasDlc;
  const hasActiveFilters = Boolean(
    q ||
    alternativeSource ||
    source !== "ALL" ||
    state !== "ALL" ||
    sort !== "newest" ||
    collection !== "ALL" ||
    handheld !== "ALL" ||
    hasDlc,
  );
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    ["q", "source", "alt", "state", "sort", "collection", "handheld", "hasDlc", "page"].forEach((key) => params.delete(key));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex w-full flex-wrap items-start gap-x-4 gap-y-3 md:w-auto">
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <Input
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search your catalog"
          aria-label="Search your catalog"
          className="w-full md:w-60"
        />
        <div className="hidden md:block">
          <Select value={sort} onValueChange={(v) => update("sort", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-1.5 md:flex" aria-label="Library state filters">
        {STATE_CHIPS.map((option) => (
          <Chip
            key={option.value}
            active={state === option.value}
            onClick={() => toggleState(option.value)}
          >
            {option.label}
          </Chip>
        ))}
        <Chip
          active={hasDlc}
          onClick={() => update("hasDlc", hasDlc ? "" : "true")}
        >
          Has DLC
        </Chip>
      </div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              hasHiddenFilters
                ? "border-signal/40 bg-signal/10 text-signal-strong"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontalIcon className="size-3.5" />
            <span className="md:hidden">Filters</span>
            <span className="hidden md:inline">More filters</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            side="bottom"
            sideOffset={6}
            className="z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-card"
          >
            <div className="space-y-4">
              <div className="md:hidden">
                <p className="technical-label mb-1.5 text-muted-foreground">Sort</p>
                <Select value={sort} onValueChange={(v) => update("sort", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-56">
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="technical-label mb-1.5 text-muted-foreground">State</p>
                <Select value={state === "ALL" ? "ALL" : state} onValueChange={(v) => update("state", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-56">
                    {STATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 md:hidden">
                  <Chip active={hasDlc} onClick={() => update("hasDlc", hasDlc ? "" : "true")}>
                    Has DLC
                  </Chip>
                </div>
              </div>

              <div>
                <p className="technical-label mb-1.5 text-muted-foreground">Platform</p>
                <Select
                  value={alternativeSource ? `alt:${alternativeSource}` : source}
                  onValueChange={updateSource}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-56">
                    {SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                    {alternativeSources.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Alternative sources</SelectLabel>
                        {alternativeSources.map((alternative) => (
                          <SelectItem key={alternative.id} value={`alt:${alternative.id}`}>
                            <span className="flex items-center gap-2">
                              <SourceIcon iconName={alternative.iconName} brandIcon={alternative.brandIcon} />
                              {alternative.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="technical-label mb-1.5 text-muted-foreground">Collection</p>
                <Select value={collection} onValueChange={(v) => update("collection", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-56">
                    <SelectItem value="ALL">All shelves</SelectItem>
                    {systemCollections.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>System</SelectLabel>
                        {systemCollections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {personalTagCollections.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Personal tags</SelectLabel>
                        {personalTagCollections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="technical-label mb-1.5 text-muted-foreground">Handheld</p>
                <Select value={handheld} onValueChange={(v) => update("handheld", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-56">
                    <SelectItem value="ALL">Any handheld status</SelectItem>
                    <SelectItem value="marked">Marked</SelectItem>
                    <SelectItem value="unmarked">Unmarked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                >
                  Reset filters
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="hidden items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-signal/40 hover:bg-signal/10 hover:text-signal-strong md:inline-flex"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
