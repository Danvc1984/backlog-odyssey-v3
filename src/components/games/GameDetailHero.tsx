import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
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
  compatibilityActive: boolean;
  hasArtwork: boolean;
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
  compatibilityActive,
  hasArtwork,
}: GameDetailHeroProps) {
  const isDlc = type === "DLC";

  return (
    <section
      className="game-detail-hero overflow-hidden rounded-lg border border-border bg-card shadow-card"
      aria-labelledby="game-detail-title"
    >
      <DetailHeroArt
        id={id}
        title={name}
        imageUrl={imageUrl}
        hideLabel
        fit="cover"
        className="aspect-[24/10] min-h-44 rounded-t-lg"
      />
      <div className="game-detail-hero__content flex min-w-0 flex-col justify-between gap-4 rounded-b-lg p-4 sm:p-6 md:p-8">
        <h1
          id="game-detail-title"
          className="text-[clamp(1.875rem,8vw,4rem)] font-extrabold leading-[0.96] tracking-[-0.05em] sm:leading-[0.92] sm:tracking-[-0.08em]"
        >
          {name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {!isDlc && (isInLibrary ? (
            <LibraryInterestRating gameId={id} gameName={name} interest={interest} />
          ) : (
            <span className="text-sm text-warning" aria-label={`Play priority: ${interest ?? 0} of 5 stars`}>
              {interest ? `${"★".repeat(interest)}${"☆".repeat(5 - interest)}` : "☆☆☆☆☆"}
            </span>
          ))}
          <span className="technical-label">Added {addedAt}</span>
          <span>
            <strong className="text-foreground">Type</strong> {type === "DLC" ? "DLC" : "Base game"}
          </span>
          <span>
            <strong className="text-foreground">Origin</strong> {origin.replaceAll("_", " ").toLowerCase()}
          </span>
        </div>

        <nav aria-label="Game detail actions" className="flex flex-wrap items-start gap-2">
          {!isDlc ? (
            <Link
              href="#personal-data"
              className="inline-flex h-9 w-full items-center justify-center rounded-[8px] bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30 sm:w-auto"
            >
              Update play state data
            </Link>
          ) : (
            <Link
              href="#maintenance"
              className="inline-flex h-9 w-full items-center justify-center rounded-[8px] bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30 sm:w-auto"
            >
              IDGB Enrichment
            </Link>
          )}

          <div className="hidden flex-wrap items-start gap-2 lg:flex">
            {!isDlc && (
              <>
                <Link href="#maintenance" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">IGDB enrichment</Link>
                <Link href="#tags" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Manage tags</Link>
                <Link href="#availability" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Change platform</Link>
                <Link href="#dlc" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">DLC</Link>
                {compatibilityActive && <Link href="#compatibility" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Compatibility</Link>}
              </>
            )}
            {hasArtwork && <Link href="#artwork" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-3 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30">Artwork</Link>}
            <Link href="#delete" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-red-500/40 bg-red-500/10 px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-500/40 dark:text-red-300">Delete</Link>
          </div>

          <details className="group min-w-0 basis-full lg:hidden">
            <summary className="relative flex h-9 w-full cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-input px-2.5 text-sm font-bold text-foreground outline-none transition-colors focus-visible:border-signal focus-visible:ring-3 focus-visible:ring-signal/30 [&::-webkit-details-marker]:hidden">
              <span>More actions</span>
              <CaretDownIcon aria-hidden="true" className="absolute right-2 size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid w-full grid-cols-1 gap-2 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 sm:grid-cols-2">
              {!isDlc && (
                <>
                  <Link
                    href="#maintenance"
                    className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                  >
                    IDGB Enrichment
                  </Link>
                  <Link
                    href="#tags"
                    className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                  >
                    Manage tags
                  </Link>
                  <Link
                    href="#availability"
                    className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                  >
                    Change platform
                  </Link>
                  <Link
                    href="#dlc"
                    className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                  >
                    DLC
                  </Link>
                  {compatibilityActive && (
                    <Link
                      href="#compatibility"
                      className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                    >
                      Compatibility
                    </Link>
                  )}
                </>
              )}
              {hasArtwork && (
                <Link
                  href="#artwork"
                  className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-strong bg-card-alt px-2 text-center text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal/30"
                >
                  Artwork
                </Link>
              )}
              <Link
                href="#delete"
                className="inline-flex h-9 items-center justify-center rounded-[8px] border border-red-500/40 bg-red-500/10 px-2 text-center text-xs font-bold text-red-700 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-red-500/40 dark:text-red-300"
              >
                Delete
              </Link>
            </div>
          </details>
        </nav>
      </div>
    </section>
  );
}
