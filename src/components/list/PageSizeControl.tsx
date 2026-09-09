"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/lib/list-pagination";

export function PageSizeControl({ size }: { size: PageSize }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const changeSize = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "18") {
      params.delete("size");
    } else {
      params.set("size", value);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Select value={String(size)} onValueChange={changeSize}>
      <SelectTrigger aria-label="Games per page" className="w-[7.5rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZES.map((pageSize) => (
          <SelectItem key={pageSize} value={String(pageSize)}>
            {pageSize} per page
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
