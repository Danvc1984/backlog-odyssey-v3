"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusPillTone } from "@/components/ui/detail-card";

const PAGE_SIZE = 6;

interface AcquiredDlc {
  id: string;
  name: string;
  coverUrl: string | null;
  matchStatus: "enriched" | "pending" | "no-match";
}

interface WishlistDlc {
  id: string;
  name: string;
  interest: number | null;
  coverUrl: string | null;
}

function acquiredStatus(status: AcquiredDlc["matchStatus"]): { label: string; tone: StatusPillTone } {
  if (status === "enriched") return { label: "IGDB matched", tone: "ok" };
  if (status === "pending") return { label: "IGDB pending", tone: "signal" };
  return { label: "No IGDB match", tone: "neutral" };
}

function Pagination({
  label,
  page,
  total,
  onPrevious,
  onNext,
}: {
  label: string;
  page: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
      <span>{label}: {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
      <span className="flex items-center gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onPrevious} disabled={page === 0}>
          Previous
        </Button>
        <span aria-label={`${label} page ${page + 1} of ${pageCount}`}>{page + 1} / {pageCount}</span>
        <Button type="button" variant="outline" size="xs" onClick={onNext} disabled={page >= pageCount - 1}>
          Next
        </Button>
      </span>
    </div>
  );
}

function Cover({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  return (
    <div
      className="aspect-[16/9] bg-gradient-to-br from-primary/25 via-muted to-card bg-cover bg-center"
      style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      aria-label={`${title} cover`}
      role="img"
    />
  );
}

export function DlcCardShelves({
  dlcs,
  wishlistDlcs,
}: {
  dlcs: AcquiredDlc[];
  wishlistDlcs: WishlistDlc[];
}) {
  const [acquiredPage, setAcquiredPage] = useState(0);
  const [wishlistPage, setWishlistPage] = useState(0);
  const acquired = dlcs.slice(acquiredPage * PAGE_SIZE, (acquiredPage + 1) * PAGE_SIZE);
  const wishlist = wishlistDlcs.slice(wishlistPage * PAGE_SIZE, (wishlistPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {dlcs.length > 0 && (
        <section aria-labelledby="acquired-dlc-heading" className="space-y-3">
          <h3 id="acquired-dlc-heading" className="text-sm font-semibold">Acquired DLC</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {acquired.map((dlc) => {
              const status = acquiredStatus(dlc.matchStatus);
              return (
                <Link
                  key={dlc.id}
                  href={`/games/${dlc.id}`}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
                >
                  <Cover title={dlc.name} coverUrl={dlc.coverUrl} />
                  <div className="grid gap-2 p-3">
                    <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{dlc.name}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="ok">Acquired</StatusPill>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination
            label="Acquired DLC"
            page={acquiredPage}
            total={dlcs.length}
            onPrevious={() => setAcquiredPage((page) => Math.max(0, page - 1))}
            onNext={() => setAcquiredPage((page) => Math.min(Math.ceil(dlcs.length / PAGE_SIZE) - 1, page + 1))}
          />
        </section>
      )}

      {wishlistDlcs.length > 0 && (
        <section aria-labelledby="wishlist-dlc-heading" className="space-y-3">
          <h3 id="wishlist-dlc-heading" className="text-sm font-semibold">Wishlist DLC</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wishlist.map((dlc) => (
              <Link
                key={dlc.id}
                href={`/wishlist/${dlc.id}`}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
              >
                <Cover title={dlc.name} coverUrl={dlc.coverUrl} />
                <div className="grid gap-2 p-3">
                  <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{dlc.name}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="signal">In wishlist</StatusPill>
                    {dlc.interest ? (
                      <span className="text-xs text-muted-foreground" aria-label={`${dlc.interest} of 5 stars`}>
                        {`${"★".repeat(dlc.interest)}${"☆".repeat(5 - dlc.interest)}`}
                      </span>
                    ) : null}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination
            label="Wishlist DLC"
            page={wishlistPage}
            total={wishlistDlcs.length}
            onPrevious={() => setWishlistPage((page) => Math.max(0, page - 1))}
            onNext={() => setWishlistPage((page) => Math.min(Math.ceil(wishlistDlcs.length / PAGE_SIZE) - 1, page + 1))}
          />
        </section>
      )}
    </div>
  );
}
