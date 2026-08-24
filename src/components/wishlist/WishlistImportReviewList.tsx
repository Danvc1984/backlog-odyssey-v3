"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createWishlistImportReviewAsNew,
  ignoreWishlistImportReview,
  linkWishlistImportReview,
} from "@/actions/wishlist-import-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReviewCandidate {
  gameId: string;
  name: string;
  type: "BASE_GAME" | "DLC";
}

export interface WishlistReviewTarget {
  id: string;
  name: string;
  type: "BASE_GAME" | "DLC";
  source: "CATALOG" | "WISHLIST";
}

interface ReviewView {
  id: string;
  steamAppId: string;
  name: string;
  candidates: ReviewCandidate[];
}

export function WishlistImportReviewList({
  initialReviews,
  targets,
}: {
  initialReviews: ReviewView[];
  targets: WishlistReviewTarget[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolve = async (
    reviewId: string,
    operation: () => Promise<{ success: boolean; error: string | null }>,
  ) => {
    setBusyId(reviewId);
    const result = await operation();
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error ?? "Review action failed");
      return;
    }
    setReviews((current) => current.filter((review) => review.id !== reviewId));
    toast.success("Wishlist review updated");
    router.refresh();
  };

  return (
    <div className="mt-5 space-y-3">
      {reviews.map((review) => {
        const query = search[review.id] ?? "";
        const matchingTargets = targets.filter((target) =>
          target.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        );
        const selectedTarget = selected[review.id] ?? review.candidates[0]?.gameId ?? matchingTargets[0]?.id ?? "";
        const disabled = busyId === review.id;

        return (
          <article key={review.id} className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">Possible match: {review.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Steam App {review.steamAppId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || !selectedTarget}
                  onClick={() => void resolve(review.id, () => linkWishlistImportReview({ reviewId: review.id, targetId: selectedTarget }))}
                >
                  Link selected
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void resolve(review.id, () => createWishlistImportReviewAsNew({ reviewId: review.id }))}
                >
                  Create as new
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => void resolve(review.id, () => ignoreWishlistImportReview({ reviewId: review.id }))}
                >
                  Ignore
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Input
                aria-label={`Search targets for ${review.name}`}
                placeholder="Search all games..."
                value={query}
                onChange={(event) => setSearch((current) => ({ ...current, [review.id]: event.target.value }))}
                disabled={disabled}
              />
              <select
                aria-label={`Target for ${review.name}`}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={selectedTarget}
                disabled={disabled || matchingTargets.length === 0}
                onChange={(event) => setSelected((current) => ({ ...current, [review.id]: event.target.value }))}
              >
                {matchingTargets.map((target) => (
                  <option key={`${target.source}-${target.id}`} value={target.id}>
                    {target.name} ({target.source.toLocaleLowerCase()}, {target.type === "DLC" ? "DLC" : "base game"})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Suggested matches:</span>
              {review.candidates.length > 0 ? review.candidates.map((candidate) => (
                <span key={candidate.gameId} className="rounded-full border border-border px-2 py-0.5">
                  {candidate.name} ({candidate.type === "DLC" ? "DLC" : "base game"})
                </span>
              )) : <span>No stored candidate</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
