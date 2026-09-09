import type { Prisma } from "@/generated/prisma/client";
import { fuzzyMatch } from "@/lib/fuzzy-match";

export interface WishlistSearchFilters {
  type?: "BASE_GAME" | "DLC";
  interest?: number;
  query?: string;
}

interface WishlistSortableEntry {
  id: string;
  interest: number | null;
  updatedAt: Date;
  offerView: {
    selected: {
      discount: number | null;
    } | null;
  };
}

interface WishlistMatchableEntry {
  name: string;
  type: string;
  baseGameName: string | null;
}

export function wishlistWhere(filters: WishlistSearchFilters): Prisma.WishlistEntryWhereInput {
  return {
    type: filters.type,
    interest: filters.interest,
  };
}

export function matchWishlistEntries<T extends WishlistMatchableEntry>(
  query: string,
  entries: readonly T[],
): T[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [...entries];

  return entries.filter((entry) => {
    const nameMatch = fuzzyMatch(trimmedQuery, entry.name);
    const baseGameMatch = entry.type === "DLC" && entry.baseGameName
      ? fuzzyMatch(trimmedQuery, entry.baseGameName)
      : { matched: false, score: 0 };
    return nameMatch.matched || baseGameMatch.matched;
  });
}

export function sortWishlistEntries<T extends WishlistSortableEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => {
    const leftDiscount = left.offerView.selected?.discount ?? 0;
    const rightDiscount = right.offerView.selected?.discount ?? 0;
    const leftHasDiscount = leftDiscount > 0;
    const rightHasDiscount = rightDiscount > 0;

    if (leftHasDiscount !== rightHasDiscount) return rightHasDiscount ? 1 : -1;

    return (
      rightDiscount - leftDiscount ||
      (right.interest ?? 0) - (left.interest ?? 0) ||
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      left.id.localeCompare(right.id)
    );
  });
}
