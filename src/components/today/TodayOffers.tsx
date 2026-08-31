import Link from "next/link";
import type { TodayOfferView } from "@/lib/today-offers";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function TodayOffers({ offers }: { offers: readonly TodayOfferView[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Best current offers</h2>
      {offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fresh wishlist offers right now.</p>
      ) : (
        <ul className="space-y-3">
          {offers.map((offer) => (
            <li key={offer.wishlistEntryId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <Link href={`/wishlist/${offer.wishlistEntryId}`} className="font-medium hover:underline">{offer.gameName}</Link>
              <span className="flex flex-wrap items-baseline gap-x-3 text-muted-foreground">
                <span>{offer.discountPercent === null ? "No discount" : `${offer.discountPercent}% off`}</span>
                <span>{offer.price.toFixed(2)} {offer.currency}</span>
                <span>{offer.store}</span>
                <span>fetched {formatDate(offer.fetchedAt)}</span>
                {offer.sellerUrl && <a href={offer.sellerUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">seller</a>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
