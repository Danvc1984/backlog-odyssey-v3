import Link from "next/link";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { LibraryInterestRating } from "@/components/games/LibraryInterestRating";

interface GameDetailHeroProps {
  id: string;
  name: string;
  type: string;
  origin: string;
  addedAt: string;
  interest: number | null;
  isInLibrary: boolean;
  imageUrl: string | null;
}

export function GameDetailHero({
  id,
  name,
  type,
  origin,
  addedAt,
  interest,
  isInLibrary,
  imageUrl,
}: GameDetailHeroProps) {
  return (
    <section
      className="game-detail-hero grid overflow-hidden rounded-lg border border-border bg-card shadow-card lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]"
      aria-labelledby="game-detail-title"
    >
      <DetailHeroArt
        id={id}
        title={name}
        imageUrl={imageUrl}
        hideLabel
        className="aspect-[16/10] min-h-64 lg:min-h-full"
      />
      <div className="game-detail-hero__content flex min-w-0 flex-col justify-between gap-5 p-6 md:p-8">
        <h1
          id="game-detail-title"
          className="text-[clamp(2.25rem,5vw,4.5rem)] font-extrabold leading-[0.92] tracking-[-0.08em]"
        >
          {name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {isInLibrary ? (
            <LibraryInterestRating gameId={id} gameName={name} interest={interest} />
          ) : (
            <span className="text-sm text-warning" aria-label={`${interest ?? 0} of 5 stars`}>
              {interest ? `${"★".repeat(interest)}${"☆".repeat(5 - interest)}` : "☆☆☆☆☆"}
            </span>
          )}
          <span className="technical-label text-muted-foreground">Added {addedAt}</span>
        </div>
        <div className="game-detail-hero__meta flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">Type</strong> {type === "DLC" ? "DLC" : "Base game"}
          </span>
          <span>
            <strong className="text-foreground">Origin</strong>{" "}
            {origin.replaceAll("_", " ").toLowerCase()}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="#play-state"
            className="inline-flex h-9 items-center justify-center rounded-[8px] bg-primary px-3 text-sm font-bold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
          >
            Change play state
          </Link>
          <Link
            href="#personal-fields"
            className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card px-3 text-sm font-bold transition-colors hover:bg-card-alt focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
          >
            Edit personal fields
          </Link>
        </div>
      </div>
    </section>
  );
}
