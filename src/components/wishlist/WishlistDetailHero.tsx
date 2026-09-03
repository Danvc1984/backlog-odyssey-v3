import Link from "next/link";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { StatusPill } from "@/components/ui/detail-card";
import { WishlistInterestRating } from "@/components/wishlist/WishlistInterestRating";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

export function WishlistDetailHero({
  id,
  name,
  type,
  imageUrl,
  interest,
  gameExperience,
  addedAt,
  baseGame,
}: {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  interest: number | null;
  gameExperience: string | null;
  addedAt: string;
  baseGame: { id: string; name: string } | null;
}) {
  return (
    <section
      className="grid overflow-hidden rounded-lg border border-border bg-card shadow-card lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]"
      aria-labelledby="wishlist-detail-title"
    >
      <DetailHeroArt
        id={id}
        title={name}
        imageUrl={imageUrl}
        hideLabel
        className="min-h-64 lg:min-h-full"
      />
      <div className="flex min-w-0 flex-col justify-between gap-8 p-6 md:p-8">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill tone="opportunity">{TYPE_LABELS[type] ?? type}</StatusPill>
          </div>
          <h1
            id="wishlist-detail-title"
            className="text-[clamp(2.25rem,5vw,4.5rem)] font-extrabold leading-[0.92] tracking-[-0.08em]"
          >
            {name}
          </h1>
          {baseGame && (
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
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <WishlistInterestRating entryId={id} entryName={name} interest={interest} />
            <span className="technical-label text-muted-foreground">Added {addedAt}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="#offers"
              className="inline-flex h-9 items-center justify-center rounded-[8px] bg-primary px-3 text-sm font-bold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
            >
              View offers
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
