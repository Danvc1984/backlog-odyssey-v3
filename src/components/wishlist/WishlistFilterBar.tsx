"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_OPTIONS = [
  { value: "ALL", label: "All wishlist" },
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

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "ALL") params.delete(key);
      else params.set(key, value);
      router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-2" aria-label="Wishlist filters">
      <Select
        value={searchParams.get("type") ?? "ALL"}
        onValueChange={(value) => update("type", value)}
      >
        <SelectTrigger aria-label="Wishlist type" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("interest") ?? "ALL"}
        onValueChange={(value) => update("interest", value)}
      >
        <SelectTrigger aria-label="Wishlist interest" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INTEREST_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
