import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WishlistEntryActions } from "@/components/wishlist/WishlistEntryActions";
import { WishlistIdentity } from "@/components/wishlist/WishlistIdentity";
import { WishlistOfferAlternatives } from "@/components/wishlist/WishlistOfferAlternatives";
import { WishlistOfferSection } from "@/components/wishlist/WishlistOfferSection";
import { WishlistCompatibilityBlock } from "@/components/wishlist/WishlistCompatibilityBlock";
import { WishlistIgdbEnrichmentControl } from "@/components/wishlist/WishlistIgdbEnrichmentControl";
import { MetadataSection } from "@/components/games/MetadataSection";
import { RecommendationItemCard } from "@/components/recommendations/RecommendationItemCard";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import type { WishlistIgdbSnapshotPayload } from "@/lib/wishlist-igdb-enrichment";
import type { DurationProfile } from "@/lib/playtime-evidence";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { getWishlistCompatibilityEligibility } from "@/lib/wishlist-compatibility";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import { parseProtonDbSummary } from "@/lib/protondb-api";
import { RecommendationRoleLabel } from "@/components/recommendations/RecommendationRoleLabel";
import { CalibrationNote } from "@/components/recommendations/CalibrationNote";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { WishlistDetailHero } from "@/components/wishlist/WishlistDetailHero";
import { DeleteWishlistEntrySection } from "@/components/wishlist/DeleteWishlistEntrySection";
import { GameThemeScope } from "@/components/games/GameThemeScope";
import { ScreenshotsSection } from "@/components/games/ScreenshotsSection";
import { resolvePagePalette } from "@/lib/game-theme";
import { resolveIgdbPageScreenshots } from "@/lib/screenshot-view";
import { deriveWindowsFallbackExists, linuxDevicePhrase } from "@/lib/os-setup";
import { getCompatibilityGate } from "@/lib/compat-gate";
import { SourceIcon } from "@/components/sources/SourceIcon";

export default async function WishlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, baseGames, buyDismissalCount, compatibilityGate, appSettings] = await Promise.all([
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
        handheldSuitable: true,
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
              where: { provider: "IGDB" },
              orderBy: { fetchedAt: "desc" },
              take: 1,
              select: { provider: true, payload: true, sourceUrl: true, fetchedAt: true },
            },
          },
        },
        metadataSnapshot: {
          select: { provider: true, payload: true, sourceUrl: true, fetchedAt: true },
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
    getCompatibilityGate(),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { durationProfile: true } }),
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
  const configuredLinuxDevicePhrase = linuxDevicePhrase(
    compatibilityGate.setup ?? { primaryOs: "LINUX", handheldOs: "NONE" },
  );

  const ownSnapshot = entry.metadataSnapshot?.provider === "IGDB" ? entry.metadataSnapshot : null;
  const inheritedSnapshot = entry.baseGame?.metadataSnapshots[0] ?? null;
  const ownMetadata = parseIgdbMetadataPayload(ownSnapshot?.payload);
  const inheritedMetadata = parseIgdbMetadataPayload(
    inheritedSnapshot?.payload,
  );
  const metadata = ownMetadata ?? inheritedMetadata;
  const resolvedSnapshot = ownMetadata ? ownSnapshot : inheritedSnapshot;
  const resolvedPayload = metadata as WishlistIgdbSnapshotPayload | null;
  const themePayload = resolvedPayload;
  const screenshots = resolveIgdbPageScreenshots(resolvedPayload);
  const durationEvidence = resolvedPayload?.durationEvidence
    ? {
        provider: resolvedPayload.durationEvidence.provider,
        payload: resolvedPayload.durationEvidence.payload,
        sourceUrl: resolvedPayload.durationEvidence.sourceUrl,
        fetchedAt: new Date(resolvedPayload.durationEvidence.fetchedAt),
      }
    : null;
  const durationProfile = (appSettings?.durationProfile ?? "NORMALLY") as DurationProfile;
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
    <GameThemeScope palette={resolvePagePalette(themePayload)}>
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
        imageUrl={metadata ? (metadata.artworkUrls[0] ?? metadata.screenshots[0]?.image ?? metadata.coverUrl ?? null) : null}
        interest={entry.interest}
        gameExperience={entry.gameExperience}
        handheldSuitable={entry.handheldSuitable}
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
            durationEvidence={durationEvidence}
            durationProfile={durationProfile}
          />
          {!ownMetadata && inheritedMetadata && (
            <p className="text-xs text-muted-foreground">
              Metadata inherited from the base game.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-warning-text">
          IGDB metadata is not available yet. Use Edit to search and choose a
          match.
        </p>
      )}

      {entry.type === "BASE_GAME" && (
        <WishlistIgdbEnrichmentControl wishlistEntryId={entry.id} hasSnapshot={ownSnapshot !== null} />
      )}

      <SectionCard
        eyebrow="Current offers"
        title={<span className="inline-flex items-center gap-2">Offers <SourceIcon iconName="Box" brandIcon="itad.svg" /></span>}
        id="offers"
        description={<>Cheapest valid offers via <a href="https://isthereanydeal.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">ITAD</a>. Prices are shown only when the store identity is confirmed.</>}
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
            imageUrl={metadata ? (metadata.artworkUrls[0] ?? metadata.screenshots[0]?.image ?? metadata.coverUrl ?? null) : null}
            offerDiscount={offerView.selected?.discount ?? null}
          />
        </SectionCard>
      )}

      {compatibilityGate.active && (
        <WishlistCompatibilityBlock
          wishlistEntryId={entry.id}
          eligibility={eligibility}
          protonDb={protonDb ? { tier: protonDb.tier } : null}
          antiCheat={antiCheat}
          hasWindowsFallback={compatibilityGate.setup ? deriveWindowsFallbackExists(compatibilityGate.setup) : false}
          linuxDevicePhrase={configuredLinuxDevicePhrase}
          environments={entry.envCompat.map((row) => ({
            environment: row.environment,
            status: row.status,
            source: row.source,
          }))}
          latestSnapshotAt={latestCompatAt}
        />
      )}

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
                handheldSuitable: entry.handheldSuitable,
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

      <ScreenshotsSection
        id={entry.id}
        title={entry.name}
        screenshots={screenshots}
        artworkUrls={metadata?.artworkUrls}
        conceptArtUrls={metadata?.conceptArtUrls}
        coverUrl={metadata?.coverUrl}
        sourceUrl={resolvedSnapshot?.sourceUrl ?? null}
        provider="IGDB"
      />

      <DeleteWishlistEntrySection entryId={entry.id} entryName={entry.name} />
    </div>
    </GameThemeScope>
  );
}
