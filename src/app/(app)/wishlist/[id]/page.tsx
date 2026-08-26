import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WishlistEntryActions } from "@/components/wishlist/WishlistEntryActions";
import { WishlistIdentity } from "@/components/wishlist/WishlistIdentity";
import { WishlistOfferAlternatives } from "@/components/wishlist/WishlistOfferAlternatives";
import { WishlistOfferSection } from "@/components/wishlist/WishlistOfferSection";
import { MetadataSection } from "@/components/games/MetadataSection";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { buildEntryOfferView } from "@/lib/offer-selection";

export default async function WishlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, baseGames] = await Promise.all([
    prisma.wishlistEntry.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        baseGameId: true,
        interest: true,
        notes: true,
        steamAppId: true,
        steamAppIdProvenance: true,
        targetPriceMxn: true,
        offers: {
          orderBy: [{ price: { sort: "asc", nulls: "last" } }],
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
  ]);

  if (!entry) {
    redirect("/wishlist");
  }

  const ownSnapshot = entry.metadataSnapshot;
  const inheritedSnapshot = entry.baseGame?.metadataSnapshots[0] ?? null;
  const ownMetadata = parseRawgMetadataPayload(ownSnapshot?.payload);
  const inheritedMetadata = parseRawgMetadataPayload(inheritedSnapshot?.payload);
  const metadata = ownMetadata ?? inheritedMetadata;
  const resolvedSnapshot = ownMetadata ? ownSnapshot : inheritedSnapshot;
  const offerView = buildEntryOfferView(entry.offers, entry.targetPriceMxn, new Date());
  const steamStoreIsSelected = offerView.selected?.shop === "Steam Store";
  const alternatives = steamStoreIsSelected
    ? offerView.alternatives
    : offerView.alternatives.filter((offer) => offer.shop !== "Steam Store");

  return (
    <div className="space-y-6">
      <Link
        href="/wishlist"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to wishlist
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {entry.type === "DLC" ? "DLC" : "Base game"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{entry.name}</h1>
          {entry.baseGame && (
            <p className="mt-2 text-sm text-muted-foreground">
              DLC for{" "}
              <Link
                href={`/games/${entry.baseGame.id}`}
                className="text-primary hover:underline"
              >
                {entry.baseGame.name}
              </Link>
            </p>
          )}
        </div>
        <div className="grid justify-items-end gap-2">
          <span className="shrink-0 text-sm" aria-label={`${entry.interest ?? 0} of 5 stars`}>
            {entry.interest
              ? `${"★".repeat(entry.interest)}${"☆".repeat(5 - entry.interest)}`
              : "No rating"}
          </span>
          <WishlistEntryActions
            entry={{
              id: entry.id,
              name: entry.name,
              type: entry.type,
              baseGameId: entry.baseGameId,
              interest: entry.interest,
            }}
            baseGames={baseGames}
          />
        </div>
      </div>

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

      <WishlistOfferSection
        offerView={offerView}
        hasConfirmedIdentity={entry.steamAppId !== null}
      />
      <WishlistOfferAlternatives alternatives={alternatives} />

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
          RAWG metadata is not available yet. Use Edit to search and choose a match.
        </p>
      )}

      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
    </div>
  );
}
