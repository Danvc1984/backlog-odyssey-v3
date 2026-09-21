"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PersonalTagShelfControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = searchParams.get("tagSort") ?? "alphabetical";

  return (
    <Select
      value={sort}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "alphabetical") params.delete("tagSort");
        else params.set("tagSort", value);
        router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-48" aria-label="Tag shelf order">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="alphabetical">Alphabetical</SelectItem>
        <SelectItem value="game-count">Most games</SelectItem>
      </SelectContent>
    </Select>
  );
}
