export interface PriceCountBucket {
  total: number;
  refreshed: number;
  notFound: number;
  noOffers: number;
  failed: number;
  identityRequired: number;
  conversionUnavailable?: boolean;
}

export function readCounts(value: unknown): PriceCountBucket {
  const fallback: PriceCountBucket = {
    total: 0,
    refreshed: 0,
    notFound: 0,
    noOffers: 0,
    failed: 0,
    identityRequired: 0,
  };
  if (typeof value !== "object" || value === null) {
    return fallback;
  }
  return { ...fallback, ...(value as Partial<PriceCountBucket>) };
}
