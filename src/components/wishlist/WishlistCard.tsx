import Link from "next/link";
import { WishlistEntryActions } from "./WishlistEntryActions";
import type { WishlistOffersView } from "@/types/wishlist-offers";
import { formatDescriptionPreview } from "@/lib/cover-presentation";
import type { WishlistCardMetadataView } from "@/lib/card-metadata-view";
import { WishlistCover } from "./WishlistCover";
import { WishlistInterestRating } from "./WishlistInterestRating";
import { ProtonDbTag } from "@/components/games/ProtonDbTag";
import type { ProtonDbCardTier } from "@/lib/protondb-tags";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "No current price";
  return `${currency?.trim().toUpperCase() ?? "Unknown currency"} ${priceFormatter.format(price)}`;
}

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
    protonDbTier: ProtonDbCardTier | null;
    steamAppId: string | null;
    steamAppIdProvenance: string | null;
    metadata: WishlistCardMetadataView | null;
    metadataGenres: string[];
    hasOwnMetadata: boolean;
    hasInheritedMetadata: boolean;
  };
}

export function WishlistCard({
  entry,
  baseGames,
  variant = "focus",
}: WishlistCardProps & { variant?: "focus" | "list" }) {
  const imageUrl = entry.metadata?.imageUrl ?? null;
  const coverTitle = entry.type === "DLC" ? `${entry.name} (DLC)` : entry.name;
  const selectedOffer = entry.offerView.selected;
  const descriptionPreview = entry.metadata?.description
    ? formatDescriptionPreview(entry.metadata.description)
    : null;

  if (variant === "list") {
    return (
      <article className={`overflow-hidden rounded-lg border border-border shadow-card ${entry.type === "DLC" ? "bg-primary/5" : "bg-card"}`}>
        <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <WishlistCover
            id={entry.id}
            title={coverTitle}
            imageUrl={imageUrl}
            className="aspect-[4/3] w-28 shrink-0 sm:w-32"
            showTitle={false}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h2 className="min-w-0 text-base font-bold leading-snug tracking-[-0.02em]">
                  <Link href={`/wishlist/${entry.id}`} className="hover:underline">
                    {coverTitle}
                  </Link>
                </h2>
                <WishlistInterestRating
                  entryId={entry.id}
                  entryName={entry.name}
                  interest={entry.interest}
                />
                {entry.protonDbTier && <ProtonDbTag tier={entry.protonDbTier} />}
              </div>
              <WishlistEntryActions entry={entry} baseGames={baseGames} />
            </div>
            {entry.steamAppId !== null && (
              <Link
                href={`/wishlist/${entry.id}#offers`}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold hover:text-primary"
                aria-label={`Open offers for ${entry.name}`}
              >
                {formatPrice(selectedOffer?.price ?? null, selectedOffer?.currency ?? null)}
                {selectedOffer?.discount !== null && selectedOffer?.discount !== undefined && selectedOffer.discount > 0 && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                    -{selectedOffer.discount}%
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`overflow-hidden rounded-lg border border-border shadow-card ${entry.type === "DLC" ? "bg-primary/5" : "bg-card"}`}>
      <WishlistCover id={entry.id} title={coverTitle} imageUrl={imageUrl} />
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="sr-only">{entry.name}</h2>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <WishlistInterestRating
              entryId={entry.id}
              entryName={entry.name}
              interest={entry.interest}
            />
            {entry.protonDbTier && <ProtonDbTag tier={entry.protonDbTier} />}
          </div>
          <WishlistEntryActions entry={entry} baseGames={baseGames} />
        </div>

        {entry.type === "BASE_GAME" && !entry.hasOwnMetadata && !entry.hasInheritedMetadata && (
          <p className="text-xs text-muted-foreground">
            RAWG metadata is not available yet. Use Edit to search and choose a match.
          </p>
        )}

        {entry.steamAppId !== null && (
          <Link
            href={`/wishlist/${entry.id}#offers`}
            className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm hover:text-primary"
            aria-label={`Open offers for ${entry.name}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {formatPrice(selectedOffer?.price ?? null, selectedOffer?.currency ?? null)}
              {selectedOffer?.discount !== null && selectedOffer?.discount !== undefined && selectedOffer.discount > 0 && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                  -{selectedOffer.discount}%
                </span>
              )}
            </span>
          </Link>
        )}

        {entry.metadata && (
          <div className="space-y-2 text-sm">
            {descriptionPreview && (
              <div className="hidden sm:block">
                <p
                  className="line-clamp-3 overflow-hidden leading-6 text-muted-foreground"
                >
                  {descriptionPreview}
                </p>
              </div>
            )}
            {entry.metadataGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.metadataGenres.map((genre) => (
                  <span key={genre} className="rounded-md border border-border px-2 py-0.5 text-xs">
                    {genre}
                  </span>
                ))}
              </div>
            )}
            {entry.hasInheritedMetadata && (
              <p className="text-xs text-muted-foreground">Metadata inherited from the base game.</p>
            )}
          </div>
        )}

        {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
      </div>
    </article>
  );
}
