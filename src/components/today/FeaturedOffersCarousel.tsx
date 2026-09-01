import Link from "next/link";
import { Carousel } from "@/components/today/Carousel";
import type { TodayOfferView } from "@/lib/today-offers";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function OfferSlide({ offer, rank }: { offer: TodayOfferView; rank: number }) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-opportunity/80 via-card to-card-alt p-6 shadow-card">
      <div className="absolute right-0 top-0 size-40 rounded-full bg-opportunity/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex min-h-52 flex-col justify-between gap-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="technical-label text-opportunity-text">Featured offer</p>
          <span className="rounded-full bg-opportunity/15 px-2.5 py-1 text-xs font-medium text-opportunity-text">
            #{rank} {offer.targetMet ? "target met" : "wishlist offer"}
          </span>
        </div>
        <div>
          <Link href={`/wishlist/${offer.wishlistEntryId}`} className="font-display text-4xl font-semibold tracking-tight hover:underline">
            {offer.gameName}
          </Link>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-2xl font-semibold">{offer.price.toFixed(2)} {offer.currency}</span>
            <span className="text-sm text-muted-foreground">
              {offer.discountPercent === null ? "No discount" : `${offer.discountPercent}% off`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span>{offer.store}</span>
          <span>fetched {formatDate(offer.fetchedAt)}</span>
          {offer.sellerUrl && (
            <a href={offer.sellerUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
              Seller
            </a>
          )}
          <Link href={`/wishlist/${offer.wishlistEntryId}`} className="underline underline-offset-4 hover:text-foreground">
            Wishlist details
          </Link>
        </div>
      </div>
    </article>
  );
}

export function FeaturedOffersCarousel({ offers }: { offers: readonly TodayOfferView[] }) {
  if (offers.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Featured offers</h2>
        <p className="text-sm text-muted-foreground">No fresh wishlist offers right now.</p>
      </section>
    );
  }

  const slides = offers.map((offer, index) => (
    <OfferSlide key={offer.wishlistEntryId} offer={offer} rank={index + 1} />
  ));
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Featured offers</h2>
      <Carousel label="Featured offers" slides={slides} />
    </section>
  );
}
