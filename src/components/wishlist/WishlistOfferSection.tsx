import { TagIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import type { WishlistOffersView } from "@/types/wishlist-offers";
import { shouldGlowOffer } from "@/lib/deal-glow";
import { cn } from "@/lib/utils";

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

function sourcePriceLabel(offer: { sourcePrice: number | null; sourceCurrency: string | null; currency: string | null }): string | null {
  if (
    offer.sourcePrice === null ||
    !offer.sourceCurrency ||
    offer.sourceCurrency.trim().toUpperCase() === offer.currency?.trim().toUpperCase()
  ) {
    return null;
  }
  return `Source: ${formatCurrency(offer.sourcePrice, offer.sourceCurrency)}`;
}

function conversionLabel(offer: { displayCurrency?: string | null; currency: string | null; isEstimated?: boolean; conversionUnavailable?: boolean }): string | null {
  if (offer.conversionUnavailable) {
    return `Display conversion unavailable; showing ${offer.currency?.trim().toUpperCase() ?? "source currency"}.`;
  }
  if (offer.isEstimated) {
    return `Estimated ${offer.displayCurrency?.trim().toUpperCase() ?? "display currency"} value.`;
  }
  return null;
}

export function WishlistOfferSection({
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
  const isMxnComparable =
    offer.currency?.trim().toUpperCase() === "MXN" &&
    (offer.sourceCurrency?.trim().toUpperCase() ?? offer.currency?.trim().toUpperCase()) === "MXN";

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        {offer.url ? (
          <a
            href={offer.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {offer.shop}
          </a>
        ) : (
          <span className="font-semibold">{offer.shop}</span>
        )}
        <span className="text-xl font-bold text-primary">
          {formatCurrency(offer.price, offer.currency)}
        </span>
      </div>
      {offer.isKeyshop && (
        <p className="flex items-center gap-1 text-xs font-medium text-amber-300">
          <WarningIcon className="size-3" aria-hidden="true" />
          Keyshop activation may vary by selected market.
        </p>
      )}
      {sourcePriceLabel(offer) && (
        <p className="text-xs text-muted-foreground">{sourcePriceLabel(offer)}</p>
      )}
      {conversionLabel(offer) && <p className="text-xs text-muted-foreground">{conversionLabel(offer)}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {offer.discount !== null && offer.discount > 0 && (
          <span className={cn("rounded bg-emerald-500/15 px-2 py-1 text-sm font-bold text-emerald-300", shouldGlowOffer(offer.discount) && "shadow-glow")}>
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
      {offerView.targetPriceMxn !== null && isMxnComparable && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Target: {formatCurrency(offerView.targetPriceMxn, "MXN")}
          </span>
          {offerView.opportunity.hasBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 font-medium text-fuchsia-300">
              <TagIcon className="size-3" aria-hidden="true" />
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
          {sourcePriceLabel(steamStoreOffer) && (
            <p className="mt-1 text-xs text-muted-foreground">{sourcePriceLabel(steamStoreOffer)}</p>
          )}
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
