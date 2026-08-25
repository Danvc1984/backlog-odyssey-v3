"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WishlistOfferView } from "@/types/wishlist-offers";

const numberFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) {
    return "Price unavailable";
  }

  return `${currency?.trim().toUpperCase() ?? "Unknown currency"} ${numberFormatter.format(value)}`;
}

function sourcePriceLabel(offer: WishlistOfferView): string | null {
  if (
    offer.sourcePrice === null ||
    !offer.sourceCurrency ||
    offer.sourceCurrency.trim().toUpperCase() === offer.currency?.trim().toUpperCase()
  ) {
    return null;
  }
  return `Source: ${formatCurrency(offer.sourcePrice, offer.sourceCurrency)}`;
}

export function WishlistOfferAlternatives({
  alternatives,
}: {
  alternatives: WishlistOfferView[];
}) {
  const [expanded, setExpanded] = React.useState(false);

  if (alternatives.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronUp /> : <ChevronDown />}
        {expanded ? "Hide offers" : `+${alternatives.length} more offers`}
      </Button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {alternatives.map((offer, index) => (
            <div
              key={`${offer.shop}-${offer.url ?? "offer"}-${index}`}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                {offer.url ? (
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-primary hover:underline"
                  >
                    {offer.shop}
                  </a>
                ) : (
                  <span className="truncate text-foreground">{offer.shop}</span>
                )}
                {offer.isKeyshop && (
                  <span
                    className="mt-1 flex items-center gap-1 text-amber-300"
                    title="Keyshop - activation not guaranteed in Mexico"
                  >
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    Keyshop - activation not guaranteed in Mexico
                  </span>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="font-medium">{formatCurrency(offer.price, offer.currency)}</span>
                {sourcePriceLabel(offer) && (
                  <p className="text-muted-foreground">{sourcePriceLabel(offer)}</p>
                )}
                {offer.discount !== null && offer.discount > 0 && (
                  <span className="ml-1 text-emerald-400">-{offer.discount}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
