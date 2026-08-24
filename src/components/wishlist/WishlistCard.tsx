import Link from "next/link";
import Image from "next/image";
import { Tag, TriangleAlert } from "lucide-react";
import type { RawgMetadataPayload } from "@/lib/rawg-types";
import { WishlistEntryActions } from "./WishlistEntryActions";
import { WishlistIdentity } from "./WishlistIdentity";
import { WishlistOfferAlternatives } from "./WishlistOfferAlternatives";
import type { WishlistOffersView } from "@/types/wishlist-offers";

interface WishlistCardProps {
  baseGames: { id: string; name: string }[];
  entry: {
    id: string;
    name: string;
    type: string;
    baseGameId: string | null;
    interest: number | null;
    notes: string | null;
    offerView: WishlistOffersView;
    steamAppId: string | null;
    steamAppIdProvenance: string | null;
    baseGame: {
      id: string;
      name: string;
      metadataSnapshots: { payload: unknown; sourceUrl: string | null; fetchedAt: Date }[];
    } | null;
    metadataSnapshot: {
      payload: unknown;
      sourceUrl: string | null;
      fetchedAt: Date;
    } | null;
  };
}

function metadataPayload(value: unknown): RawgMetadataPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const payload = value as Partial<RawgMetadataPayload>;
  return typeof payload.title === "string" && Array.isArray(payload.genres)
    ? (value as RawgMetadataPayload)
    : null;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) {
    return "Price unavailable";
  }

  return `${currency?.trim().toUpperCase() ?? "Unknown currency"} ${mxnFormatter.format(value)}`;
}

function WishlistOfferSection({
  offerView,
  hasConfirmedIdentity,
}: {
  offerView: WishlistOffersView;
  hasConfirmedIdentity: boolean;
}) {
  if (!hasConfirmedIdentity) {
    return null;
  }

  if (offerView.selected === null) {
    return (
      <div className="border-t border-border pt-3 text-sm text-muted-foreground">
        No offers available
      </div>
    );
  }

  const offer = offerView.selected;
  const steamStoreOffer = [offer, ...offerView.alternatives].find(
    (candidate) => candidate.shop === "Steam Store",
  );
  const hasDifferentRegularPrice =
    offer.regularPrice !== null && offer.regularPrice !== offer.price;

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">{offer.shop}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-semibold">{formatCurrency(offer.price, offer.currency)}</span>
          {offer.isKeyshop && (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-300"
              title="Keyshop - activation not guaranteed in Mexico"
            >
              <TriangleAlert className="size-3" aria-hidden="true" />
              Keyshop - activation not guaranteed in Mexico
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {offer.discount !== null && offer.discount > 0 && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400">
            -{offer.discount}%
          </span>
        )}
        {hasDifferentRegularPrice && (
          <span>from {formatCurrency(offer.regularPrice, offer.currency)}</span>
        )}
        {offer.historicalLow !== null && (
          <span>
            Historical low: {formatCurrency(offer.historicalLow, offer.currency)}
          </span>
        )}
      </div>
      {offerView.targetPriceMxn !== null && offer.currency?.toUpperCase() === "MXN" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Target: {formatCurrency(offerView.targetPriceMxn, "MXN")}
          </span>
          {offerView.opportunity.hasBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 font-medium text-fuchsia-300">
              <Tag className="size-3" aria-hidden="true" />
              Opportunity
            </span>
          )}
        </div>
      )}
      {offerView.isStale && (
        <p className="text-xs text-muted-foreground">Price may be outdated.</p>
      )}
      {steamStoreOffer && steamStoreOffer !== offer && (
        <div className="border-t border-border pt-2">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">Steam Store</span>
            <span className="font-semibold">
              {formatCurrency(steamStoreOffer.price, steamStoreOffer.currency)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {steamStoreOffer.discount !== null && steamStoreOffer.discount > 0 && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400">
                -{steamStoreOffer.discount}%
              </span>
            )}
            {steamStoreOffer.regularPrice !== null &&
              steamStoreOffer.regularPrice !== steamStoreOffer.price && (
                <span>from {formatCurrency(steamStoreOffer.regularPrice, steamStoreOffer.currency)}</span>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

export function WishlistCard({ entry, baseGames }: WishlistCardProps) {
  const ownMetadata = metadataPayload(entry.metadataSnapshot?.payload);
  const inheritedMetadata = metadataPayload(entry.baseGame?.metadataSnapshots[0]?.payload);
  const metadata = ownMetadata ?? inheritedMetadata;
  const imageUrl = metadata?.backgroundImageUrls[0] ?? null;
  const sourceUrl = entry.metadataSnapshot?.sourceUrl ?? entry.baseGame?.metadataSnapshots[0]?.sourceUrl ?? metadata?.rawgUrl ?? null;
  const steamStoreIsSelected = entry.offerView.selected?.shop === "Steam Store";
  const alternatives = steamStoreIsSelected
    ? entry.offerView.alternatives
    : entry.offerView.alternatives.filter((offer) => offer.shop !== "Steam Store");

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      {imageUrl ? (
        <div className="relative h-40 w-full">
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 33vw, 100vw"
            className="object-cover"
            loading="lazy"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
          No artwork
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold leading-tight">{entry.name}</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {entry.type === "DLC" ? "DLC" : "Base game"}
            </p>
          </div>
          <div className="grid justify-items-end gap-2">
            <span className="shrink-0 text-sm" aria-label={`${entry.interest ?? 0} of 5 stars`}>
              {entry.interest ? `${"★".repeat(entry.interest)}${"☆".repeat(5 - entry.interest)}` : "No rating"}
            </span>
            <WishlistEntryActions entry={entry} baseGames={baseGames} />
          </div>
        </div>

        {entry.baseGame && (
          <p className="text-sm text-muted-foreground">
            DLC for{" "}
            <Link href={`/games/${entry.baseGame.id}`} className="text-primary hover:underline">
              {entry.baseGame.name}
            </Link>
          </p>
        )}

        {entry.type === "BASE_GAME" && !ownMetadata && (
          <p className="text-xs text-muted-foreground">
            RAWG metadata is not available yet. Use Edit to search and choose a match.
          </p>
        )}

        <WishlistIdentity
          entryId={entry.id}
          entryName={entry.name}
          steamAppId={entry.steamAppId}
          provenance={entry.steamAppIdProvenance}
          snapshot={
            entry.metadataSnapshot
              ? { payload: entry.metadataSnapshot.payload, fetchedAt: entry.metadataSnapshot.fetchedAt }
              : null
          }
        />

        <WishlistOfferSection
          offerView={entry.offerView}
          hasConfirmedIdentity={entry.steamAppId !== null}
        />
        <WishlistOfferAlternatives alternatives={alternatives} />

        {metadata && (
          <div className="space-y-2 text-sm">
            {metadata.description && (
              <p className="line-clamp-3 text-muted-foreground">{metadata.description}</p>
            )}
            {metadata.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {metadata.genres.map((genre) => (
                  <span key={genre} className="rounded-md border border-border px-2 py-0.5 text-xs">
                    {genre}
                  </span>
                ))}
              </div>
            )}
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                RAWG source
              </a>
            )}
            {!ownMetadata && inheritedMetadata && (
              <p className="text-xs text-muted-foreground">Metadata inherited from the base game.</p>
            )}
          </div>
        )}

        {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
      </div>
    </article>
  );
}
