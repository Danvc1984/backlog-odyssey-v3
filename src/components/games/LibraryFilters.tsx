"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Popover } from "radix-ui";
import { SlidersHorizontal } from "lucide-react";
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
  { value: "PLAYED_BEFORE", label: "Played before" },
];

const STATE_OPTIONS = [
  { value: "ALL", label: "All states" },
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PLAYED_BEFORE", label: "Played before" },
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
  alternativeSources: { id: string; name: string; iconName: string }[];
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

  const systemCollections = collections.filter((c) => c.isSystem);
  const manualCollections = collections.filter((c) => !c.isSystem);

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
    state === "ABANDONED" ||
    (collection !== null && collection !== "ALL");

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search your catalog"
          aria-label="Search your catalog"
          className="w-60"
        />
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

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Library state filters">
        {STATE_CHIPS.map((option) => (
          <Chip
            key={option.value}
            active={state === option.value}
            onClick={() => toggleState(option.value)}
          >
            {option.label}
          </Chip>
        ))}
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
            <SlidersHorizontal className="size-3.5" />
            More filters
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
              </div>

              <div>
                <p className="technical-label mb-1.5 text-muted-foreground">Source</p>
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
                              <SourceIcon iconName={alternative.iconName} />
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
                    <SelectItem value="ALL">All collections</SelectItem>
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
                    {manualCollections.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Mine</SelectLabel>
                        {manualCollections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}