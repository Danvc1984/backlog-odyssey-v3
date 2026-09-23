import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { AcquireWishlistDialog } from "@/components/wishlist/AcquireWishlistDialog";
import { EditWishlistDialog } from "@/components/wishlist/EditWishlistDialog";
import type { WishlistOfferView } from "@/types/wishlist-offers";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(offer: WishlistOfferView): string {
  if (offer.price === null) return "Price unavailable";
  return `${offer.currency?.trim().toUpperCase() ?? "Unknown currency"} ${priceFormatter.format(offer.price)}`;
}

function externalOfferUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function WishlistDetailHero({
  id,
  name,
  type,
  imageUrl,
  addedAt,
  baseGame,
  baseGames,
  interest,
  gameExperience,
  handheldSuitable,
  selectedOffer,
  alternativeSources = [],
  compatibilityActive,
  compatibilityEligible,
  hasArtwork,
}: {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  addedAt: string;
  baseGame: { id: string; name: string } | null;
  baseGames: { id: string; name: string }[];
  interest: number | null;
  gameExperience: string | null;
  handheldSuitable: boolean | null;
  selectedOffer: WishlistOfferView | null;
  alternativeSources?: {
    id: string;
    name: string;
    iconName: string;
    brandIcon?: string;
  }[];
  compatibilityActive: boolean;
  compatibilityEligible: boolean;
  hasArtwork: boolean;
}) {
  return (
    <section
      className="game-detail-hero grid overflow-visible rounded-lg border border-border bg-card shadow-card lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]"
      aria-labelledby="wishlist-detail-title"
    >
      <DetailHeroArt
        id={id}
        title={name}
        imageUrl={imageUrl}
        hideLabel
        className="aspect-[16/10] min-h-64 self-start rounded-t-lg lg:rounded-l-lg lg:rounded-tr-none"
      />
      <div className="game-detail-hero__content flex min-w-0 flex-col justify-between gap-8 rounded-b-lg p-6 md:p-8 lg:rounded-r-lg lg:rounded-bl-none">
        <div>
          {type === "DLC" && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="technical-label text-muted-foreground">DLC</span>
            </div>
          )}
          <h1
            id="wishlist-detail-title"
            className="text-[clamp(2rem,4.5vw,4rem)] font-extrabold leading-[0.92] tracking-[-0.08em]"
          >
            {name}
          </h1>
          {type === "DLC" && baseGame && (
            <p className="mt-5 text-sm text-muted-foreground">
              DLC for{" "}
              <Link href={`/games/${baseGame.id}`} className="text-primary hover:underline">
                {baseGame.name}
              </Link>
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="technical-label text-muted-foreground">Added {addedAt}</span>
          </div>
          {selectedOffer && (
            <div className="mt-6 rounded-lg border border-border-strong bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {externalOfferUrl(selectedOffer.url) ? (
                  <a href={externalOfferUrl(selectedOffer.url)!} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4 hover:text-primary">
                    Best current offer from {selectedOffer.shop}
                  </a>
                ) : (
                  <span className="font-semibold">Best current offer from {selectedOffer.shop}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold text-emerald-300">{formatPrice(selectedOffer)}</span>
                {selectedOffer.discount !== null && selectedOffer.discount > 0 && (
                  <span className="rounded bg-emerald-500/15 px-2 py-1 text-sm font-bold text-emerald-300">
                    -{selectedOffer.discount}%
                  </span>
                )}
              </div>
              {selectedOffer.isEstimated && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Estimated {selectedOffer.displayCurrency ?? "display currency"} value; source price retained below.
                </p>
              )}
              {selectedOffer.conversionUnavailable && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Display conversion unavailable; showing the authoritative source price.
                </p>
              )}
              {selectedOffer.isKeyshop && (
                <p className="mt-2 text-xs font-medium text-amber-300">
                  Keyshop activation may vary by selected market.
                </p>
              )}
            </div>
          )}
          <nav aria-label="Wishlist detail actions" className="mt-6 flex flex-wrap items-start gap-2">
            <AcquireWishlistDialog
              entry={{ id, name, type }}
              imageUrl={imageUrl}
              selectedOffer={selectedOffer}
              alternativeSources={alternativeSources}
            />
            <details className="group relative min-w-64 flex-1">
              <summary className="relative flex h-9 w-full cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-input px-2.5 text-sm font-bold text-foreground outline-none transition-colors focus-visible:border-signal focus-visible:ring-3 focus-visible:ring-signal/30 [&::-webkit-details-marker]:hidden">
                <span>More actions</span>
                <CaretDownIcon aria-hidden="true" className="absolute right-2 size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-50 mt-1 grid w-full min-w-64 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
                <Link href="#details" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">IGDB enrichment</Link>
                <Link href="#offers" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Compare offers</Link>
                <EditWishlistDialog
                  entry={{
                    id,
                    name,
                    type,
                    baseGameId: baseGame?.id ?? null,
                    interest,
                    gameExperience,
                    handheldSuitable,
                  }}
                  baseGames={baseGames}
                  compactTrigger
                />
                <Link href="#personal-fit" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Personal fit</Link>
                <Link href="#maintenance" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Enrichment controls</Link>
                {compatibilityActive && compatibilityEligible && <Link href="#compatibility" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Compatibility</Link>}
                {hasArtwork && <Link href="#artwork" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Artwork</Link>}
                <Link href="#delete" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-red-500/40 bg-red-500/10 px-2 text-center text-xs font-bold text-red-700 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-500/40 dark:text-red-300">Delete</Link>
              </div>
            </details>
          </nav>
        </div>
      </div>
    </section>
  );
}
