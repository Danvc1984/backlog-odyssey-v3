import Link from "next/link";
import Image from "next/image";
import { WishlistEntryActions } from "./WishlistEntryActions";
import { WishlistIdentity } from "./WishlistIdentity";
import { WishlistOfferAlternatives } from "./WishlistOfferAlternatives";
import { WishlistOfferSection } from "./WishlistOfferSection";
import type { WishlistOffersView } from "@/types/wishlist-offers";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";

interface WishlistCardProps {
  baseGames: { id: string; name: string }[];
  entry: {
    id: string;
    name: string;
    type: string;
    baseGameId: string | null;
    interest: number | null;
    gameExperience: string | null;
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

export function WishlistCard({ entry, baseGames }: WishlistCardProps) {
  const ownMetadata = parseRawgMetadataPayload(entry.metadataSnapshot?.payload);
  const inheritedMetadata = parseRawgMetadataPayload(
    entry.baseGame?.metadataSnapshots[0]?.payload,
  );
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
            <h2 className="font-semibold leading-tight">
              <Link href={`/wishlist/${entry.id}`} className="hover:underline">
                {entry.name}
              </Link>
            </h2>
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
