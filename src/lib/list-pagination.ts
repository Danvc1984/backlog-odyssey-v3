export const PAGE_SIZES = [18, 48, 99] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export interface PaginationRange {
  page: number;
  size: PageSize;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
}

export function parsePageSize(value: string | null | undefined): PageSize {
  if (value === "18" || value === "48" || value === "99") {
    return Number(value) as PageSize;
  }

  return 18;
}

export function parsePage(value: string | null | undefined, totalPages: number): number {
  const parsed = value && /^\d+$/.test(value) ? Number(value) : NaN;
  const safeTotalPages = Math.max(0, Math.floor(totalPages));

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return safeTotalPages > 0 ? Math.min(parsed, safeTotalPages) : 1;
}

export function resolveRange(total: number, page: number, size: PageSize): PaginationRange {
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages = Math.ceil(safeTotal / size);
  const resolvedPage = Math.min(Math.max(1, Math.floor(page)), Math.max(1, totalPages));

  return {
    page: resolvedPage,
    size,
    totalPages,
    rangeStart: safeTotal === 0 ? 0 : (resolvedPage - 1) * size + 1,
    rangeEnd: safeTotal === 0 ? 0 : Math.min(resolvedPage * size, safeTotal),
  };
}
