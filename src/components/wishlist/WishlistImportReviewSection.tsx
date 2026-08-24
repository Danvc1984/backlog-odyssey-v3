import { prisma } from "@/lib/prisma";
import { WishlistImportReviewList, type WishlistReviewTarget } from "@/components/wishlist/WishlistImportReviewList";

interface ReviewCandidate {
  gameId: string;
  name: string;
  type: "BASE_GAME" | "DLC";
}

export interface WishlistImportReviewView {
  id: string;
  steamAppId: string;
  name: string;
  candidates: ReviewCandidate[];
}

function parseCandidates(value: unknown): ReviewCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ReviewCandidate>;
    if (
      typeof item.gameId !== "string" ||
      typeof item.name !== "string" ||
      (item.type !== "BASE_GAME" && item.type !== "DLC")
    ) return [];
    return [{ gameId: item.gameId, name: item.name, type: item.type }];
  });
}

export async function WishlistImportReviewSection() {
  const [reviews, games, wishlistEntries] = await Promise.all([
    prisma.wishlistImportReview.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, steamAppId: true, name: true, candidates: true },
    }),
    prisma.game.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.wishlistEntry.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (reviews.length === 0) return null;

  const targets: WishlistReviewTarget[] = [
    ...games.map((game) => ({ ...game, source: "CATALOG" as const })),
    ...wishlistEntries.map((entry) => ({ ...entry, source: "WISHLIST" as const })),
  ];
  const reviewViews: WishlistImportReviewView[] = reviews.map((review) => ({
    ...review,
    candidates: parseCandidates(review.candidates),
  }));

  return (
    <section id="wishlist-import-reviews" aria-labelledby="wishlist-import-reviews-heading">
      <div className="mt-6">
        <h2 id="wishlist-import-reviews-heading" className="text-lg font-semibold">Wishlist import reviews</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm a local match before attaching the Steam identity. Nothing is linked automatically.
        </p>
      </div>
      <WishlistImportReviewList initialReviews={reviewViews} targets={targets} />
    </section>
  );
}
