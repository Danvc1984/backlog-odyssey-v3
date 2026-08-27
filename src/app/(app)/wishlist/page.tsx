import { WishlistFilterBar } from "@/components/wishlist/WishlistFilterBar";
import { WishlistList } from "@/components/wishlist/WishlistList";
import { AddWishlistDialog } from "@/components/wishlist/AddWishlistDialog";
import { PriceRefreshPanel } from "@/components/wishlist/PriceRefreshPanel";
import { WishlistCompatSweepPanel } from "@/components/wishlist/WishlistCompatSweepPanel";
import { ImportSteamWishlistButton } from "@/components/wishlist/ImportSteamWishlistButton";
import { WishlistImportReviewSection } from "@/components/wishlist/WishlistImportReviewSection";
import { WishlistSyncChip } from "@/components/wishlist/WishlistSyncChip";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { prisma } from "@/lib/prisma";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { wishlistWhere } from "@/lib/wishlist-search";

interface WishlistSearchParams {
  type?: string;
  interest?: string;
  q?: string;
}

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<WishlistSearchParams>;
}) {
  const params = await searchParams;
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Games and DLCs you may want to acquire later.
          </p>
        </div>
        <div className="flex items-start gap-3">
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
      <div className="mt-5">
        <WishlistFilterBar />
      </div>
      <WishlistImportReviewSection />
      <WishlistList entries={entriesWithOfferViews} baseGames={baseGames} />
    </div>
  );
}
