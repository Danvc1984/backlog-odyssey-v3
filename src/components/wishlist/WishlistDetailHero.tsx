import Link from "next/link";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { StatusPill } from "@/components/ui/detail-card";
import { WishlistInterestRating } from "@/components/wishlist/WishlistInterestRating";
import { AcquireWishlistDialog } from "@/components/wishlist/AcquireWishlistDialog";
import { Button } from "@/components/ui/button";
import type { WishlistOfferView } from "@/types/wishlist-offers";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

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
  interest,
  gameExperience,
  handheldSuitable,
  addedAt,
  baseGame,
  selectedOffer,
  alternativeSources = [],
}: {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  interest: number | null;
  gameExperience: string | null;
  handheldSuitable: boolean | null;
  addedAt: string;
  baseGame: { id: string; name: string } | null;
  selectedOffer: WishlistOfferView | null;
  alternativeSources?: {
    id: string;
    name: string;
    iconName: string;
    brandIcon?: string;
  }[];
}) {
  return (
    <section
      className="game-detail-hero grid overflow-hidden rounded-lg border border-border bg-card shadow-card lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]"
      aria-labelledby="wishlist-detail-title"
    >
      <DetailHeroArt
        id={id}
        title={name}
        imageUrl={imageUrl}
        hideLabel
        className="aspect-[16/10] min-h-64 lg:min-h-full"
      />
      <div className="game-detail-hero__content flex min-w-0 flex-col justify-between gap-8 p-6 md:p-8">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill tone="opportunity">{TYPE_LABELS[type] ?? type}</StatusPill>
          </div>
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
          {gameExperience && (
            <p className="mt-2 text-xs text-muted-foreground">
              Experience: {gameExperience.replaceAll("_", " ").toLowerCase()}
            </p>
          )}
          {handheldSuitable === true && (
            <p className="mt-2 text-xs text-muted-foreground">Handheld option</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <WishlistInterestRating entryId={id} entryName={name} interest={interest} />
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
              {selectedOffer.isKeyshop && (
                <p className="mt-2 text-xs font-medium text-amber-300">
                  Keyshop activation is not guaranteed in Mexico.
                </p>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <AcquireWishlistDialog
              entry={{ id, name, type }}
              imageUrl={imageUrl}
              selectedOffer={selectedOffer}
              alternativeSources={alternativeSources}
            />
            <Button asChild size="lg" variant="secondary">
              <Link href="#offers">Compare offers</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
