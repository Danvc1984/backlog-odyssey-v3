import { WishlistFilterBar } from "@/components/wishlist/WishlistFilterBar";
import { WishlistList } from "@/components/wishlist/WishlistList";
import { AddWishlistDialog } from "@/components/wishlist/AddWishlistDialog";
import { PriceRefreshPanel } from "@/components/wishlist/PriceRefreshPanel";
import { WishlistCompatSweepPanel } from "@/components/wishlist/WishlistCompatSweepPanel";
import { ImportSteamWishlistButton } from "@/components/wishlist/ImportSteamWishlistButton";
import { WishlistImportReviewSection } from "@/components/wishlist/WishlistImportReviewSection";
import { WishlistSyncChip } from "@/components/wishlist/WishlistSyncChip";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { ViewSwitch } from "@/components/games/ViewSwitch";
import { prisma } from "@/lib/prisma";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { wishlistWhere } from "@/lib/wishlist-search";

interface WishlistSearchParams {
  type?: string;
  interest?: string;
  q?: string;
  view?: string;
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
  const type = ["BASE_GAME", "DLC"].includes(params.type ?? "")
    ? (params.type as "BASE_GAME" | "DLC")
    : undefined;
  const interest = Number(params.interest);
  const interestFilter = Number.isInteger(interest) && interest >= 1 && interest <= 5
    ? interest
    : undefined;
  const query = params.q?.trim() || undefined;

  const [entries, baseGames, latestRun, latestCompatSweep] = await Promise.all([
    prisma.wishlistEntry.findMany({
      where: wishlistWhere({ type, interest: interestFilter, query }),
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
    prisma.priceRefresh.findFirst({ orderBy: { requestedAt: "desc" } }),
    prisma.wishlistCompatSweep.findFirst({ orderBy: { requestedAt: "desc" } }),
  ]);

  const entriesWithOfferViews = entries.map(({ offers, targetPriceMxn, ...entry }) => ({
    ...entry,
    offerView: buildEntryOfferView(offers, targetPriceMxn, new Date()),
  }));
  const baseGameCount = entriesWithOfferViews.filter((entry) => entry.type === "BASE_GAME").length;
  const dlcCount = entriesWithOfferViews.filter((entry) => entry.type === "DLC").length;
  const opportunityCount = entriesWithOfferViews.filter((entry) => entry.offerView.opportunity.hasBadge).length;
  const needsAttentionCount = entriesWithOfferViews.filter((entry) => entry.steamAppId === null).length;
  const hasFilters = Boolean(query || type || interestFilter !== undefined);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="technical-label text-muted-foreground">Wishlist</p>
          <h1 className="mt-2">
            Keen on a new<br />
            <span className="text-opportunity-text">adventure?</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Your selection of wishlisted games and dlcs, discounts powered by ITAD and just enough context to know what deserves your money next.
          </p>
        </div>
        <div className="flex max-w-2xl flex-wrap items-start justify-end gap-3">
          <WishlistSyncChip />
          <ImportSteamWishlistButton />
          <UpdateRecommendationsButton />
          <PriceRefreshPanel
            initialRun={
              latestRun
                ? {
                    id: latestRun.id,
                    status: latestRun.status,
                    counts: latestRun.counts,
                    requestedAt: latestRun.requestedAt,
                    finishedAt: latestRun.finishedAt,
                  }
                : null
            }
          />
          <WishlistCompatSweepPanel
            initialRun={
              latestCompatSweep
                ? {
                    id: latestCompatSweep.id,
                    status: latestCompatSweep.status,
                    counts: latestCompatSweep.counts,
                    requestedAt: latestCompatSweep.requestedAt,
                    finishedAt: latestCompatSweep.finishedAt,
                  }
                : null
            }
          />
          <AddWishlistDialog baseGames={baseGames} />
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Wishlist signals">
        <article className="rounded-lg border border-signal/40 bg-signal/5 p-4">
          <p className="technical-label text-muted-foreground">Active wishes</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{entriesWithOfferViews.length.toString().padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{baseGameCount} base games · {dlcCount} DLC</p>
        </article>
        <article className="rounded-lg border border-opportunity/40 bg-opportunity/5 p-4">
          <p className="technical-label text-muted-foreground">Opportunity signals</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{opportunityCount.toString().padStart(2, "0")}</p>
          <p className="mt-1 text-xs text-muted-foreground">fresh offers at target</p>
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
      <WishlistList entries={entriesWithOfferViews} baseGames={baseGames} view={view} hasFilters={hasFilters} />
    </div>
  );
}
