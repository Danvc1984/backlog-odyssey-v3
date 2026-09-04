import Link from "next/link";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

export function WishlistImportStatusCard({
  openReviews,
  ignored,
}: {
  openReviews: number;
  ignored: number;
}) {
  const needsReview = openReviews > 0;

  return (
    <SectionCard
      eyebrow="Steam import"
      title="Wishlist import matches"
      description="Steam wishlist rows waiting for a local identity decision."
      status={
        <StatusPill tone={needsReview ? "warning" : "ok"}>
          {needsReview ? "Needs review" : "Clear"}
        </StatusPill>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {needsReview ? (
            <>
              <span className="font-medium text-foreground">{openReviews}</span>{" "}
              match{openReviews === 1 ? "" : "es"} waiting
            </>
          ) : (
            "No import matches waiting."
          )}{" "}
          {ignored > 0 && <span>({ignored} ignored)</span>}
        </p>
        <Link
          href="/wishlist#wishlist-import-reviews"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Review matches on Wishlist
        </Link>
      </div>
    </SectionCard>
  );
}
