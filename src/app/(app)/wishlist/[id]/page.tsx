import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WishlistEntryActions } from "@/components/wishlist/WishlistEntryActions";
import { WishlistIdentity } from "@/components/wishlist/WishlistIdentity";
import { WishlistOfferAlternatives } from "@/components/wishlist/WishlistOfferAlternatives";
import { WishlistOfferSection } from "@/components/wishlist/WishlistOfferSection";
import { WishlistCompatibilityBlock } from "@/components/wishlist/WishlistCompatibilityBlock";
import { WishlistRawgFillButton } from "@/components/wishlist/WishlistRawgFillButton";
import { MetadataSection } from "@/components/games/MetadataSection";
import { RecommendationItemCard } from "@/components/recommendations/RecommendationItemCard";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { getWishlistCompatibilityEligibility } from "@/lib/wishlist-compatibility";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { RecommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { CalibrationNote } from "@/components/recommendations/CalibrationNote";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { WishlistDetailHero } from "@/components/wishlist/WishlistDetailHero";
import { DeleteWishlistEntrySection } from "@/components/wishlist/DeleteWishlistEntrySection";

export default async function WishlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, baseGames, buyDismissalCount] = await Promise.all([
    prisma.wishlistEntry.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
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
        compatSnapshots: {
          select: {
            provider: true,
            result: true,
            sourceUrl: true,
            fetchedAt: true,
            expiresAt: true,
          },
        },
        envCompat: {
          select: { environment: true, status: true, source: true },
        },
        baseGame: {
          select: {
            id: true,
            name: true,
            metadataSnapshots: {
              where: { provider: "RAWG" },
              orderBy: { fetchedAt: "desc" },
              take: 1,
              select: { payload: true, sourceUrl: true, fetchedAt: true },
            },
          },
        },
        metadataSnapshot: {
          select: { payload: true, sourceUrl: true, fetchedAt: true },
        },
      },
    }),
    prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recommendationFeedback.count({
      where: { wishlistEntryId: id, kind: "BUY" },
    }),
  ]);

  if (!entry) {
    redirect("/wishlist");
  }

  const latestBuyRun = await prisma.recommendationRun.findFirst({
    where: { kind: "BUY" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        where: { wishlistEntryId: id },
        orderBy: { rank: "asc" },
        take: 1,
      },
    },
  });
  const buyItem = latestBuyRun?.items[0] ?? null;

  const ownSnapshot = entry.metadataSnapshot;
  const inheritedSnapshot = entry.baseGame?.metadataSnapshots[0] ?? null;
  const ownMetadata = parseRawgMetadataPayload(ownSnapshot?.payload);
  const inheritedMetadata = parseRawgMetadataPayload(
    inheritedSnapshot?.payload,
  );
  const metadata = ownMetadata ?? inheritedMetadata;
  const resolvedSnapshot = ownMetadata ? ownSnapshot : inheritedSnapshot;
  const offerView = buildEntryOfferView(
    entry.offers,
    entry.targetPriceMxn,
    new Date(),
  );
  const steamStoreIsSelected = offerView.selected?.shop === "Steam Store";
  const alternatives = steamStoreIsSelected
    ? offerView.alternatives
    : offerView.alternatives.filter((offer) => offer.shop !== "Steam Store");
  const eligibility = getWishlistCompatibilityEligibility({
    type: entry.type,
    steamAppId: entry.steamAppId,
    steamAppIdProvenance: entry.steamAppIdProvenance,
  });
  const protonDbSnapshot = entry.compatSnapshots.find(
    (snapshot) => snapshot.provider === "PROTONDB",
  );
  const protonDb =
    eligibility.eligible && protonDbSnapshot
      ? parseProtonDbSummary(eligibility.steamAppId, protonDbSnapshot.result)
      : null;
  const awaySnapshot = entry.compatSnapshots.find(
    (snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET",
  );
  const antiCheat = parseAntiCheatEvidence(awaySnapshot?.result);
  const latestCompatAt = entry.compatSnapshots.reduce<Date | null>(
    (latest, snapshot) =>
      !latest || snapshot.fetchedAt > latest ? snapshot.fetchedAt : latest,
    null,
  );

  return (
    <div className="space-y-6">
      <p className="technical-label text-muted-foreground">
        <Link
          href="/wishlist"
          className="hover:text-foreground hover:underline"
        >
          Wishlist
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{entry.name}</span>
      </p>

      <WishlistDetailHero
        id={entry.id}
        name={entry.name}
        type={entry.type}
        imageUrl={metadata?.backgroundImageUrls[0] ?? null}
        interest={entry.interest}
        gameExperience={entry.gameExperience}
        addedAt={entry.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        baseGame={entry.baseGame}
      />

      {metadata ? (
        <div className="space-y-2">
          <MetadataSection
            payload={metadata}
            sourceUrl={resolvedSnapshot?.sourceUrl ?? null}
            fetchedAt={resolvedSnapshot?.fetchedAt ?? null}
          />
          {!ownMetadata && inheritedMetadata && (
            <p className="text-xs text-muted-foreground">
              Metadata inherited from the base game.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          RAWG metadata is not available yet. Use Edit to search and choose a
          match.
        </p>
      )}

      {!entry.metadataSnapshot && entry.type === "BASE_GAME" && (
        <WishlistRawgFillButton wishlistEntryId={entry.id} />
      )}

      <SectionCard
        eyebrow="Current offers"
        title="Offers"
        id="offers"
        description="Prices are shown only when the store identity is confirmed."
        status={
          <StatusPill>
            {entry.steamAppId ? "Identity confirmed" : "Unavailable"}
          </StatusPill>
        }
        className="scroll-mt-6 outline-none target:ring-2 target:ring-primary/30 target:ring-offset-2 target:ring-offset-background"
      >
        {entry.steamAppId ? (
          <div className="space-y-3">
            <WishlistOfferSection offerView={offerView} hasConfirmedIdentity />
            <WishlistOfferAlternatives alternatives={alternatives} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Confirm a store identity above to see current offers.
          </p>
        )}
      </SectionCard>

      {buyItem && buyItem.wishlistEntryId === entry.id && (
        <SectionCard
          eyebrow="Recommendation"
          title="Buy recommendation"
          description="The current recommendation for this wishlist entry."
          status={<StatusPill tone="opportunity">Best opportunity</StatusPill>}
          tone="opportunity"
        >
          <RecommendationRoleLabel role={buyItem.role} kind="BUY" />
          <RecommendationItemCard
            target={{ kind: "BUY", wishlistEntryId: entry.id }}
            runId={latestBuyRun?.id}
            name={entry.name}
            rank={buyItem.rank}
            score={buyItem.score}
            positive={buyItem.positive}
            negative={buyItem.negative}
            caveats={buyItem.caveats}
            imageUrl={metadata?.backgroundImageUrls[0] ?? null}
          />
        </SectionCard>
      )}

      <WishlistCompatibilityBlock
        wishlistEntryId={entry.id}
        eligibility={eligibility}
        protonDb={protonDb ? { tier: protonDb.tier } : null}
        antiCheat={antiCheat}
        environments={entry.envCompat.map((row) => ({
          environment: row.environment,
          status: row.status,
          source: row.source,
        }))}
        latestSnapshotAt={latestCompatAt}
      />

      <SectionCard
        eyebrow="Wishlist entry"
        title="Identity and actions"
        description="Store identity and wishlist choices stay explicit."
        status={
          <StatusPill>
            {entry.steamAppId ? "Confirmed" : "Needs identity"}
          </StatusPill>
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WishlistIdentity
            entryId={entry.id}
            entryName={entry.name}
            steamAppId={entry.steamAppId}
            provenance={entry.steamAppIdProvenance}
            snapshot={
              entry.metadataSnapshot
                ? {
                    payload: entry.metadataSnapshot.payload,
                    fetchedAt: entry.metadataSnapshot.fetchedAt,
                  }
                : null
            }
          />
          <div className="grid justify-items-end gap-2">
            <CalibrationNote
              interest={entry.interest}
              dismissalCount={buyDismissalCount}
            />
            <WishlistEntryActions
              entry={{
                id: entry.id,
                name: entry.name,
                type: entry.type,
                baseGameId: entry.baseGameId,
                interest: entry.interest,
                gameExperience: entry.gameExperience,
              }}
              baseGames={baseGames}
              showDelete={false}
            />
          </div>
        </div>
      </SectionCard>

      {entry.notes && (
        <p className="text-sm text-muted-foreground">{entry.notes}</p>
      )}

      <DeleteWishlistEntrySection entryId={entry.id} entryName={entry.name} />
    </div>
  );
}
