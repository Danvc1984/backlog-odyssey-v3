import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  chunkItadIds,
  fetchItadPrices,
  type ItadDeal,
  type ItadGamePrices,
  type ItadProviderError,
} from "./itad-api";
import { resolveItadIds } from "./itad-identity";
import { fetchSteamStorePrices, type SteamStorePrice } from "./steam-api";
import { fetchUsdToMxnRate } from "./exchange-rate";
import {
  finalizeRun,
  recoverAbandonedRun,
  startSingleRun,
} from "./run-record-lifecycle";

export { ABANDONED_RUN_MS } from "./run-record-lifecycle";

export interface PriceRefreshCounts {
  total: number;
  refreshed: number;
  notFound: number;
  noOffers: number;
  failed: number;
  identityRequired: number;
  conversionUnavailable?: boolean;
}

export function emptyCounts(total = 0): PriceRefreshCounts {
  return { total, refreshed: 0, notFound: 0, noOffers: 0, failed: 0, identityRequired: 0 };
}

export interface EligibleEntry {
  id: string;
  name: string;
  steamAppId: string;
}

export type StartPriceRefreshResult =
  | { ok: true; runId: string; entries: EligibleEntry[] }
  | { ok: false; reason: "already-running"; runId: string };

export async function startPriceRefresh(
  now: Date = new Date(),
): Promise<StartPriceRefreshResult> {
  await recoverAbandonedRun(prisma.priceRefresh, now, "requestedAt");

  const entries = await prisma.wishlistEntry.findMany({
    where: { steamAppId: { not: null }, steamAppIdProvenance: { not: null } },
    select: { id: true, name: true, steamAppId: true },
    orderBy: { createdAt: "asc" },
  });
  const eligible: EligibleEntry[] = entries.flatMap((entry) =>
    entry.steamAppId ? [{ id: entry.id, name: entry.name, steamAppId: entry.steamAppId }] : [],
  );

  const started = await startSingleRun(
    prisma.priceRefresh,
    {
      status: "RUNNING",
      country: "MX",
      counts: emptyCounts(eligible.length) as unknown as Prisma.InputJsonValue,
    },
    { status: "RUNNING" },
  );
  if (!started.ok) {
    return started;
  }
  return { ok: true, runId: started.runId, entries: eligible };
}

export function refreshStatusFromCounts(counts: PriceRefreshCounts) {
  const succeeded = counts.refreshed + counts.notFound + counts.noOffers;
  if (counts.total > 0 && succeeded === 0) {
    return "FAILED" as const;
  }
  if (counts.failed === 0) {
    return "SUCCESS" as const;
  }
  return "PARTIAL" as const;
}

export async function finalizePriceRefresh(
  runId: string,
  counts: PriceRefreshCounts,
): Promise<void> {
  await finalizeRun(prisma.priceRefresh, runId, counts, refreshStatusFromCounts);
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DealOfferRow = Prisma.DealOfferCreateManyInput;

interface ExchangeRateSnapshot {
  rate: number;
  fetchedAt: Date;
}

function convertedDecimal(value: number | null, exchangeRate: ExchangeRateSnapshot | null): Prisma.Decimal | null {
  if (value == null) {
    return null;
  }
  const source = new Prisma.Decimal(value);
  return exchangeRate
    ? source.mul(new Prisma.Decimal(exchangeRate.rate)).toDecimalPlaces(2)
    : source;
}

function dealToRow(
  entryId: string,
  deal: ItadDeal,
  historyLow: number | null,
  now: Date,
  exchangeRate: ExchangeRateSnapshot | null,
): DealOfferRow {
  const drm = deal.drm ?? [];
  const platforms = deal.platforms ?? [];
  const sourceCurrency = deal.currency?.trim().toUpperCase() ?? null;
  const shouldConvert = sourceCurrency === "USD" && exchangeRate !== null;
  return {
    wishlistEntryId: entryId,
    shop: deal.shopName ?? "Unknown shop",
    country: "MX",
    currency: shouldConvert ? "MXN" : deal.currency,
    price: convertedDecimal(deal.price, shouldConvert ? exchangeRate : null),
    regularPrice: convertedDecimal(deal.regular, shouldConvert ? exchangeRate : null),
    discount: deal.cut != null && Number.isFinite(deal.cut) ? Math.round(deal.cut) : null,
    historicalLow: convertedDecimal(historyLow, shouldConvert ? exchangeRate : null),
    sourceCurrency: sourceCurrency,
    sourcePrice: deal.price != null ? new Prisma.Decimal(deal.price) : null,
    sourceRegularPrice: deal.regular != null ? new Prisma.Decimal(deal.regular) : null,
    sourceHistoricalLow: historyLow != null ? new Prisma.Decimal(historyLow) : null,
    exchangeRateToMxn: shouldConvert ? new Prisma.Decimal(exchangeRate.rate) : null,
    exchangeRateFetchedAt: shouldConvert ? exchangeRate.fetchedAt : null,
    voucher: deal.voucher,
    itadFlag: deal.flag,
    drm: drm.length > 0 ? drm.join(", ") : null,
    platforms: platforms.length > 0 ? (platforms as unknown as Prisma.InputJsonValue) : undefined,
    url: deal.url,
    expiresAt: parseDate(deal.expiry),
    fetchedAt: now,
  };
}

function steamPriceToRow(entryId: string, price: SteamStorePrice, now: Date): DealOfferRow {
  return {
    wishlistEntryId: entryId,
    shop: "Steam Store",
    country: "MX",
    currency: price.currency,
    price: new Prisma.Decimal(price.price),
    regularPrice: new Prisma.Decimal(price.regularPrice),
    discount: price.discount,
    historicalLow: null,
    voucher: null,
    itadFlag: null,
    drm: "Steam",
    platforms: undefined,
    url: price.url,
    expiresAt: null,
    fetchedAt: now,
  };
}

async function replaceOffers(entryIds: string[], rows: DealOfferRow[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.dealOffer.deleteMany({ where: { wishlistEntryId: { in: entryIds } } });
    if (rows.length > 0) {
      await tx.dealOffer.createMany({ data: rows });
    }
  });
}

export async function processPriceRefreshEntries(
  apiKey: string,
  entries: EligibleEntry[],
): Promise<PriceRefreshCounts> {
  const allCount = await prisma.wishlistEntry.count();
  const counts: PriceRefreshCounts = {
    ...emptyCounts(allCount),
    identityRequired: Math.max(0, allCount - entries.length),
  };

  if (entries.length === 0) {
    return counts;
  }

  let exchangeRate: ExchangeRateSnapshot | null = null;
  const exchangeRateResult = await fetchUsdToMxnRate();
  if (exchangeRateResult.ok) {
    exchangeRate = exchangeRateResult;
  } else {
    counts.conversionUnavailable = true;
  }

  const steamPrices = await fetchSteamStorePrices(entries.map((entry) => entry.steamAppId));

  const identityLookup = await resolveItadIds(
    apiKey,
    entries.map((entry) => entry.steamAppId),
  );
  if ("category" in identityLookup) {
    for (const entry of entries) {
      const steamPrice = steamPrices.get(entry.steamAppId);
      if (!steamPrice) {
        counts.failed += 1;
        continue;
      }
      try {
        await replaceOffers([entry.id], [steamPriceToRow(entry.id, steamPrice, new Date())]);
        counts.refreshed += 1;
      } catch {
        counts.failed += 1;
      }
    }
    return counts;
  }

  const priced = entries.flatMap((entry) => {
    const itadId = identityLookup.get(entry.steamAppId);
    return itadId ? [{ entry, itadId }] : [];
  });
  for (const entry of entries) {
    if (!identityLookup.get(entry.steamAppId)) {
      counts.notFound += 1;
    }
  }

  const pricesById = new Map<string, ItadGamePrices>();
  for (const chunk of chunkItadIds(priced)) {
    let outcome: ItadGamePrices[] | ItadProviderError;
    try {
      outcome = await fetchItadPrices(
        apiKey,
        chunk.map(({ itadId }) => itadId),
      );
    } catch {
      outcome = { category: "NETWORK", message: "ITAD prices could not be fetched" };
    }
    if ("category" in outcome) {
      counts.failed += chunk.length;
      continue;
    }
    for (const game of outcome) {
      pricesById.set(game.itadId, game);
    }

    const now = new Date();
    const rows: DealOfferRow[] = [];
    const entryIds: string[] = [];
    const dealtEntryIds: string[] = [];
    for (const { entry, itadId } of chunk) {
      // A known game missing from the price response counts as having no offers.
      const game = pricesById.get(itadId) ?? { itadId, historyLow: null, deals: [] };
      entryIds.push(entry.id);
      const steamPrice = steamPrices.get(entry.steamAppId);
      if (steamPrice) {
        rows.push(steamPriceToRow(entry.id, steamPrice, now));
        dealtEntryIds.push(entry.id);
      }
      if (game.deals.length === 0) {
        continue;
      }
      if (!steamPrice) {
        dealtEntryIds.push(entry.id);
      }
      rows.push(...game.deals.map((deal) => dealToRow(entry.id, deal, game.historyLow, now, exchangeRate)));
    }
    try {
      await replaceOffers(entryIds, rows);
      counts.refreshed += dealtEntryIds.length;
      counts.noOffers += entryIds.length - dealtEntryIds.length;
    } catch {
      // Persistence failures isolate to the chunk; other chunks keep their progress.
      counts.failed += entryIds.length;
    }
  }

  const pricedEntryIds = new Set(priced.map(({ entry }) => entry.id));
  for (const entry of entries) {
    if (pricedEntryIds.has(entry.id)) {
      continue;
    }
    const steamPrice = steamPrices.get(entry.steamAppId);
    if (!steamPrice) {
      continue;
    }
    try {
      await replaceOffers([entry.id], [steamPriceToRow(entry.id, steamPrice, new Date())]);
      counts.refreshed += 1;
      counts.notFound -= 1;
    } catch {
      counts.failed += 1;
    }
  }

  return counts;
}

export type RunPriceRefreshResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "already-running"; runId: string };

export async function runPriceRefresh(apiKey: string): Promise<RunPriceRefreshResult> {
  const started = await startPriceRefresh();
  if (!started.ok) {
    return started;
  }

  try {
    const counts = await processPriceRefreshEntries(apiKey, started.entries);
    await finalizePriceRefresh(started.runId, counts);
    return { ok: true, runId: started.runId };
  } catch {
    const total = started.entries.length;
    await finalizePriceRefresh(started.runId, { ...emptyCounts(total), failed: total });
    return { ok: true, runId: started.runId };
  }
}
