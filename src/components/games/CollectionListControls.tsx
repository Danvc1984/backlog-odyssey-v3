"use client";

import { useCallback } from "react";
import { Popover } from "radix-ui";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
] as const;

export function CollectionListControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const update = useCallback(
    (key: "q" | "sort", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || (key === "sort" && value === "newest")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
      <Input
        value={query}
        onChange={(event) => update("q", event.target.value)}
        placeholder="Search this collection"
        aria-label="Search this collection"
        className="w-full md:w-64"
      />
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground md:hidden">
            <SlidersHorizontalIcon className="size-3.5" />
            Sort
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" side="bottom" sideOffset={6} className="z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-card">
            <p className="technical-label mb-1.5 text-muted-foreground">Sort</p>
            <Select value={sort} onValueChange={(value) => update("sort", value)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" align="start" className="w-56">
                {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="hidden md:block">
      <Select value={sort} onValueChange={(value) => update("sort", value)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>
    </div>
  );
}
