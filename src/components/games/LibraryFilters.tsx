"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
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
  { value: "OTHER_PLATFORM", label: "Other platform" },
  { value: "ROM", label: "ROM" },
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

export function LibraryFilters({
  collections,
}: {
  collections: FilterCollection[];
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

  const systemCollections = collections.filter((c) => c.isSystem);
  const manualCollections = collections.filter((c) => !c.isSystem);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => update("q", e.target.value)}
        placeholder="Search games..."
        className="w-56"
      />
      <Select value={source} onValueChange={(v) => update("source", v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={state} onValueChange={(v) => update("state", v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={collection} onValueChange={(v) => update("collection", v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
  );
}
