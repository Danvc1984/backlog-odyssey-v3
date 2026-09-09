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
    <nav aria-label={ariaLabel} className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <PageSizeControl
          size={size}
          ariaLabel={pageSizeLabel}
          label={pageSizeLabel.replace(/\s+per page$/i, "")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => goToPage(1)}
          aria-label="First page"
        >
          <CaretDoubleLeftIcon aria-hidden />
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => goToPage(page - 1)}
          aria-label="Previous page"
        >
          <CaretLeftIcon aria-hidden />
          Previous
        </Button>
      </div>
      <span className="technical-label text-muted-foreground">
        {rangeStart}-{rangeEnd} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => goToPage(page + 1)}
          aria-label="Next page"
        >
          Next
          <CaretRightIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => goToPage(totalPages)}
          aria-label="Last page"
        >
          Last
          <CaretDoubleRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
