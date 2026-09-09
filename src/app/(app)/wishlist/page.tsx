import { WishlistFilterBar } from "@/components/wishlist/WishlistFilterBar";
import { WishlistList } from "@/components/wishlist/WishlistList";
import { AddWishlistDialog } from "@/components/wishlist/AddWishlistDialog";
import { PriceRefreshPanel } from "@/components/wishlist/PriceRefreshPanel";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { WishlistImportReviewSection } from "@/components/wishlist/WishlistImportReviewSection";
import { ViewSwitch } from "@/components/games/ViewSwitch";
import { prisma } from "@/lib/prisma";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { matchWishlistEntries, sortWishlistEntries, wishlistWhere } from "@/lib/wishlist-search";
import { getWishlistCompatibilityEligibility } from "@/lib/wishlist-compatibility";
import { deriveCompatTag } from "@/lib/protondb-tags";
import { getCompatibilityGate } from "@/lib/compat-gate";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { wishlistCardMetadataView } from "@/lib/card-metadata-view";
import { ListPaginationControls } from "@/components/list/ListPaginationControls";
import { parsePage, parsePageSize, resolveRange } from "@/lib/list-pagination";

interface WishlistSearchParams {
  type?: string;
  interest?: string;
  q?: string;
  view?: string;
  size?: string;
  page?: string;
  sort?: string;
}

type WishlistView = "focus" | "list";

function normalizeWishlistView(value: string | undefined): WishlistView {
  return value === "list" ? "list" : "focus";
}

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<WishlistSearchParams>;
}) {
  const params = await searchParams;
  const view = normalizeWishlistView(params.view);
  const size = parsePageSize(params.size);
  const rawPage = parsePage(params.page, Number.MAX_SAFE_INTEGER);
  const sort = params.sort === "discount" ? "discount" : "interest";
  const type = ["BASE_GAME", "DLC"].includes(params.type ?? "")
    ? (params.type as "BASE_GAME" | "DLC")
    : undefined;
  const interest = Number(params.interest);
  const interestFilter = Number.isInteger(interest) && interest >= 1 && interest <= 5
    ? interest
    : undefined;
  const query = params.q?.trim() || undefined;
  const compatibilityGate = await getCompatibilityGate();

  const [entries, baseGames] = await Promise.all([
    prisma.wishlistEntry.findMany({
      where: wishlistWhere({ type, interest: interestFilter }),
      orderBy: [{ interest: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        type: true,
        baseGameId: true,
        interest: true,
        gameExperience: true,
        notes: true,
        steamAppId: true,
        steamAppIdProvenance: true,
        targetPriceMxn: true,
        updatedAt: true,
        compatSnapshots: {
          where: { provider: "PROTONDB" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { result: true, fetchedAt: true },
        },
        offers: {
          orderBy: [{ price: { sort: "asc", nulls: "last" } }],
        },
        baseGame: {
          select: { id: true, name: true, metadataSnapshots: { where: { provider: "RAWG" }, orderBy: { fetchedAt: "desc" }, take: 1, select: { payload: true, sourceUrl: true, fetchedAt: true } } },
        },
        metadataSnapshot: { select: { payload: true, sourceUrl: true, fetchedAt: true } },
      },
    }),
    prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const entriesWithOfferViews = entries.map(({
    offers,
    targetPriceMxn,
    compatSnapshots,
    metadataSnapshot,
    baseGame,
    ...entry
  }) => {
    const ownPayload = parseRawgMetadataPayload(metadataSnapshot?.payload);
    const inheritedPayload = parseRawgMetadataPayload(baseGame?.metadataSnapshots[0]?.payload);
    const ownMetadata = wishlistCardMetadataView(metadataSnapshot?.payload);
    const inheritedMetadata = wishlistCardMetadataView(baseGame?.metadataSnapshots[0]?.payload);
    const metadata = ownMetadata ?? inheritedMetadata;
    const metadataPayload = ownPayload ?? inheritedPayload;
    const eligibility = getWishlistCompatibilityEligibility({
      type: entry.type,
      steamAppId: entry.steamAppId,
      steamAppIdProvenance: entry.steamAppIdProvenance,
    });
    return {
      ...entry,
      baseGameName: baseGame?.name ?? null,
      metadata,
      metadataGenres: metadataPayload?.genres ?? [],
      hasOwnMetadata: ownMetadata !== null,
      hasInheritedMetadata: ownMetadata === null && inheritedMetadata !== null,
      compatTag: eligibility.eligible
        ? deriveCompatTag({
            active: compatibilityGate.active,
            steamAppId: eligibility.steamAppId,
            isRomOnly: false,
            snapshotResult: compatSnapshots[0]?.result ?? null,
            snapshotFetchedAt: compatSnapshots[0]?.fetchedAt ?? null,
          })
        : null,
      offerView: buildEntryOfferView(offers, targetPriceMxn, new Date()),
    };
  });
  const matchedEntries = matchWishlistEntries(query ?? "", entriesWithOfferViews);
  const orderedEntries = sort === "discount"
    ? sortWishlistEntries(matchedEntries)
    : matchedEntries;
  const baseGameCount = orderedEntries.filter((entry) => entry.type === "BASE_GAME").length;
  const dlcCount = orderedEntries.filter((entry) => entry.type === "DLC").length;
  const discountedCount = orderedEntries.filter((entry) => (entry.offerView.selected?.discount ?? 0) > 0).length;
  const needsAttentionCount = orderedEntries.filter((entry) => entry.steamAppId === null).length;
  const range = resolveRange(orderedEntries.length, rawPage, size);
  const paginatedEntries = orderedEntries.slice(
    (range.page - 1) * size,
    range.page * size,
  );
  const hasFilters = Boolean(query || type || interestFilter !== undefined);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="technical-label text-muted-foreground">Wishlist</p>
          <h1 className="mt-2">
            Keen on a new<br />
            <span className="text-opportunity-text">adventure?</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Keep an eye on the games calling your name, and let the best moment to buy reveal itself. <span className="inline-flex items-center gap-1 whitespace-nowrap">Discounts powered by <a href="https://isthereanydeal.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">ITAD</a> <SourceIcon iconName="Box" brandIcon="itad.svg" /></span>
          </p>
        </div>
        <div className="flex max-w-2xl flex-wrap items-end justify-end gap-3">
          <PriceRefreshPanel />
          <AddWishlistDialog baseGames={baseGames} triggerSize="lg" />
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Wishlist signals">
        <article className="rounded-lg border border-signal/40 bg-signal/5 p-4">
          <p className="technical-label text-muted-foreground">Active wishes</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{entriesWithOfferViews.length.toString().padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{baseGameCount} base games · {dlcCount} DLC</p>
        </article>
        <article className="rounded-lg border border-opportunity/40 bg-opportunity/5 p-4">
          <p className="technical-label text-muted-foreground">Discounted games</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{discountedCount.toString().padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-muted-foreground">cheapest offers discounted now</p>
        </article>
        <article className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="technical-label text-muted-foreground">Needs your review</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{needsAttentionCount.toString().padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Steam identity pending</p>
        </article>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <WishlistFilterBar />
        <ViewSwitch
          view={view}
          label="Wishlist view"
          modes={[
            { value: "focus", label: "Focus" },
            { value: "list", label: "List" },
          ]}
        />
      </div>
      <WishlistImportReviewSection />
      <WishlistList entries={paginatedEntries} baseGames={baseGames} view={view} hasFilters={hasFilters} />
      {orderedEntries.length > 0 && (
        <ListPaginationControls
          ariaLabel="Wishlist pages"
          pageSizeLabel="Wishes per page"
          size={size}
          page={range.page}
          totalPages={range.totalPages}
          rangeStart={range.rangeStart}
          rangeEnd={range.rangeEnd}
          total={orderedEntries.length}
        />
      )}
    </div>
  );
}
