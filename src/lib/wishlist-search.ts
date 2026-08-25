import type { Prisma } from "@/generated/prisma/client";

export interface WishlistSearchFilters {
  type?: "BASE_GAME" | "DLC";
  interest?: number;
  query?: string;
}

export function wishlistWhere(filters: WishlistSearchFilters): Prisma.WishlistEntryWhereInput {
  const query = filters.query?.trim();
  return {
    type: filters.type,
    interest: filters.interest,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { baseGame: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}
