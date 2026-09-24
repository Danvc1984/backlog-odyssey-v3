"use client";

import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageSizeControl } from "@/components/list/PageSizeControl";
import type { PageSize } from "@/lib/list-pagination";

interface ListPaginationControlsProps {
  ariaLabel?: string;
  pageSizeLabel?: string;
  size: PageSize;
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
}

export function ListPaginationControls({
  ariaLabel = "Library pages",
  pageSizeLabel = "Games per page",
  size,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
}: ListPaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <nav aria-label={ariaLabel} className="mt-5 grid grid-cols-[repeat(4,max-content)] justify-center gap-2">
      <div className="contents">
        <div className="order-3 col-span-4 flex justify-center">
          <PageSizeControl
            size={size}
            ariaLabel={pageSizeLabel}
            label={pageSizeLabel.replace(/\s+per page$/i, "")}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="order-2 justify-center"
          disabled={page === 1}
          onClick={() => goToPage(1)}
          aria-label="First page"
        >
          <CaretDoubleLeftIcon aria-hidden />
          <span className="hidden md:inline">First</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="order-2 justify-center"
          disabled={page === 1}
          onClick={() => goToPage(page - 1)}
          aria-label="Previous page"
        >
          <CaretLeftIcon aria-hidden />
          <span className="hidden md:inline">Previous</span>
        </Button>
      </div>
      <span className="order-1 col-span-4 text-center technical-label text-muted-foreground">
        {rangeStart}-{rangeEnd} of {total}
      </span>
      <div className="contents">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="order-2 justify-center"
          disabled={page === totalPages}
          onClick={() => goToPage(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden md:inline">Next</span>
          <CaretRightIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="order-2 justify-center"
          disabled={page === totalPages}
          onClick={() => goToPage(totalPages)}
          aria-label="Last page"
        >
          <span className="hidden md:inline">Last</span>
          <CaretDoubleRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
