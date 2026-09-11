import Link from "next/link";
import { WishlistEntryActions } from "./WishlistEntryActions";
import type { WishlistOffersView } from "@/types/wishlist-offers";
import { formatDescriptionPreview } from "@/lib/cover-presentation";
import type { WishlistCardMetadataView } from "@/lib/card-metadata-view";
import { WishlistCover } from "./WishlistCover";
import { WishlistInterestRating } from "./WishlistInterestRating";
import { ProtonDbTag } from "@/components/games/ProtonDbTag";
import type { CompatTag } from "@/lib/protondb-tags";
import { shouldGlowBuyHeading, shouldGlowOffer } from "@/lib/deal-glow";
import { cn } from "@/lib/utils";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "No current price";
  return `${currency?.trim().toUpperCase() ?? "Unknown currency"} ${priceFormatter.format(price)}`;
}

function formatDuration(hours: number): string {
  const roundedMinutes = Math.round(hours * 60);
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const wholeHours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
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
    handheldSuitable: boolean | null;
    notes: string | null;
    offerView: WishlistOffersView;
    compatTag: CompatTag;
    steamAppId: string | null;
    steamAppIdProvenance: string | null;
    metadata: WishlistCardMetadataView | null;
    metadataGenres: string[];
    metadataDevelopers: string[];
    metadataReleaseDate: string | null;
    metadataRating: number | null;
    hasOwnMetadata: boolean;
    hasInheritedMetadata: boolean;
  };
}

export function WishlistCard({
  entry,
  baseGames,
  variant = "focus",
}: WishlistCardProps & { variant?: "focus" | "list" }) {
  const coverTitle = entry.type === "DLC" ? `${entry.name} (DLC)` : entry.name;
  const selectedOffer = entry.offerView.selected;
  const descriptionPreview = entry.metadata?.description
    ? formatDescriptionPreview(entry.metadata.description)
    : null;

  if (variant === "list") {
    const imageUrl = entry.metadata?.wideImageUrl ?? entry.metadata?.imageUrl ?? null;
    return (
      <article className={cn(
        "flex min-h-44 overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card",
        shouldGlowBuyHeading(selectedOffer?.discount) && "shadow-glow",
      )}>
        <div className="w-40 shrink-0 sm:w-48 lg:w-64 xl:w-80 min-[1600px]:w-96">
          <WishlistCover
            id={entry.id}
            title={coverTitle}
            imageUrl={imageUrl}
            className="h-full min-h-44 w-full"
            showTitle={false}
            fit="cover"
            backgroundBlur="blur-2xl"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 p-4 pb-2">
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
              {entry.compatTag && <ProtonDbTag tag={entry.compatTag} />}
            </div>
            <div className="shrink-0">
              <WishlistEntryActions entry={entry} baseGames={baseGames} />
            </div>
          </div>
          <div className="min-w-0 p-4 pt-0">
            {entry.type === "BASE_GAME" && !entry.hasOwnMetadata && !entry.hasInheritedMetadata && (
              <p className="mt-2 text-xs text-warning-text">
                IGDB metadata is not available yet. Use Edit to search and choose a match.
              </p>
            )}
            {entry.metadata && (
              <div className="mt-2 space-y-2 text-sm">
                {descriptionPreview && <p className="line-clamp-2 overflow-hidden leading-6 text-muted-foreground">{descriptionPreview}</p>}
                {(entry.metadataGenres.length > 0 || entry.metadata.durationHours !== null || entry.metadataDevelopers.length > 0 || entry.metadataReleaseDate || entry.metadataRating !== null) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.metadataGenres.slice(0, 3).map((genre) => (
                      <span key={genre} className="rounded-md border border-border px-2 py-0.5 text-xs">{genre}</span>
                    ))}
                    {entry.metadata.durationHours !== null && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs">{formatDuration(entry.metadata.durationHours)}</span>
                    )}
                    {entry.metadataDevelopers[0] && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{entry.metadataDevelopers[0]}</span>}
                    {entry.metadataReleaseDate && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{entry.metadataReleaseDate.slice(0, 4)}</span>}
                    {entry.metadataRating !== null && <span className="rounded-md border border-border px-2 py-0.5 text-xs">IGDB total {entry.metadataRating.toFixed(1)}</span>}
                  </div>
                )}
                {entry.hasInheritedMetadata && <p className="text-xs text-muted-foreground">Metadata inherited from the base game.</p>}
              </div>
            )}
            {entry.steamAppId !== null && (
              <Link
                href={`/wishlist/${entry.id}#offers`}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:text-primary"
                aria-label={`Open offers for ${entry.name}`}
              >
                {formatPrice(selectedOffer?.price ?? null, selectedOffer?.currency ?? null)}
                {selectedOffer?.discount !== null && selectedOffer?.discount !== undefined && selectedOffer.discount > 0 && (
                  <span className={cn("rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400", shouldGlowOffer(selectedOffer.discount) && "shadow-glow")}>
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
    <article className={cn(
      "flex flex-col overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card",
      shouldGlowBuyHeading(selectedOffer?.discount) && "shadow-glow",
    )}>
      <WishlistCover
        id={entry.id}
        title={coverTitle}
        imageUrl={entry.metadata?.imageUrl ?? null}
        className="aspect-[25/24]"
        fit="contain"
        backgroundBlur="blur-xl"
      />
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="sr-only">{entry.name}</h2>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <WishlistInterestRating
              entryId={entry.id}
              entryName={entry.name}
              interest={entry.interest}
            />
            {entry.compatTag && <ProtonDbTag tag={entry.compatTag} />}
          </div>
          <WishlistEntryActions entry={entry} baseGames={baseGames} />
        </div>

        {entry.type === "BASE_GAME" && !entry.hasOwnMetadata && !entry.hasInheritedMetadata && (
          <p className="text-xs text-warning-text">
            IGDB metadata is not available yet. Use Edit to search and choose a match.
          </p>
        )}

        {entry.steamAppId !== null && (
          <Link
            href={`/wishlist/${entry.id}#offers`}
            className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-sm hover:text-primary"
            aria-label={`Open offers for ${entry.name}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {formatPrice(selectedOffer?.price ?? null, selectedOffer?.currency ?? null)}
              {selectedOffer?.discount !== null && selectedOffer?.discount !== undefined && selectedOffer.discount > 0 && (
                <span className={cn("rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400", shouldGlowOffer(selectedOffer.discount) && "shadow-glow")}>
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
            {(entry.metadataDevelopers[0] || entry.metadataReleaseDate || entry.metadataRating !== null) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.metadataDevelopers[0] && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{entry.metadataDevelopers[0]}</span>}
                {entry.metadataReleaseDate && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{entry.metadataReleaseDate.slice(0, 4)}</span>}
                {entry.metadataRating !== null && <span className="rounded-md border border-border px-2 py-0.5 text-xs">IGDB total {entry.metadataRating.toFixed(1)}</span>}
              </div>
            )}
            {entry.metadata.durationHours !== null && (
              <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-xs">
                {formatDuration(entry.metadata.durationHours)}
              </span>
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
