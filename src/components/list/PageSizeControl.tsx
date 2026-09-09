"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZES, type PageSize } from "@/lib/list-pagination";
import { cn } from "@/lib/utils";

interface PageSizeControlProps {
  size: PageSize;
  ariaLabel?: string;
  label?: string;
}

export function PageSizeControl({
  size,
  ariaLabel = "Games per page",
  label = "Games",
}: PageSizeControlProps) {
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
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {PAGE_SIZES.map((pageSize, index) => (
        <span key={pageSize} className="inline-flex items-center">
          {index > 0 && <span aria-hidden className="text-muted-foreground">,</span>}
          <button
            type="button"
            aria-pressed={size === pageSize}
            onClick={() => changeSize(String(pageSize))}
            className={cn(
              "rounded px-1.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40",
              size === pageSize
                ? "bg-card-alt text-signal-strong"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {pageSize}
          </button>
        </span>
      ))}
    </div>
  );
}
