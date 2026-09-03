import Link from "next/link";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";
import { buttonVariants } from "@/components/ui/button";
import { formatFetchedAgo } from "@/lib/cover-presentation";
import type { TodayOfferView } from "@/lib/today-offers";
import { cn } from "@/lib/utils";

export interface TodayHeroGame {
  id: string;
  name: string;
  imageUrl: string | null;
  libraryEntry: {
    isMainGame: boolean;
    playState: string;
  } | null;
}

const PLAY_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PLAYED_BEFORE: "Played before",
  ABANDONED: "Abandoned",
};

function playStateLabel(playState: string): string {
  return PLAY_STATE_LABELS[playState] ?? playState.replaceAll("_", " ").toLowerCase();
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Spotlight({ game }: { game: TodayHeroGame }) {
  const isMainGame = game.libraryEntry?.isMainGame === true;
  const playState = game.libraryEntry?.playState;
  return (
    <section
      aria-labelledby="today-focus-heading"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DetailHeroArt
          id={game.id}
          title={game.name}
          imageUrl={game.imageUrl}
          code={isMainGame ? "MAIN / 001" : "PLAY / 001"}
          className="min-h-48 lg:h-full"
        />
        <div className="flex flex-col justify-between gap-6 p-6">
          <div>
            <p className="technical-label text-muted-foreground">Current focus</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isMainGame && (
                <Chip className="border-signal/40 bg-signal/10 text-signal-strong">
                  main game
                </Chip>
              )}
              {playState && (
                <Chip className="border-border bg-muted/40 text-muted-foreground">
                  {playStateLabel(playState)}
                </Chip>
              )}
            </div>
            <h2
              id="today-focus-heading"
              className="mt-3 text-2xl font-bold leading-snug tracking-[-0.04em]"
            >
              {game.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isMainGame
                ? "Your main game stays at the center of the backlog. Keep the thread warm or pick the next move below."
                : "One of your active campaigns. Keep the thread warm or pick the next move below."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Link href={`/games/${game.id}`} className={buttonVariants({ variant: "default", size: "sm" })}>
              Continue game
            </Link>
            <Link href={`/games/${game.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Open details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpotlightEmpty() {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="technical-label text-muted-foreground">Current focus</p>
      <h2 className="mt-3 text-xl font-bold tracking-[-0.03em]">Nothing queued here yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Choose a main game or mark a title in progress from its detail page to keep it close at hand here.
      </p>
      <Link
        href="/library"
        className="mt-5 w-fit text-sm font-medium text-signal-strong underline underline-offset-4 hover:text-foreground"
      >
        Open library
      </Link>
    </section>
  );
}

function BuySignal({ offer }: { offer: TodayOfferView }) {
  return (
    <aside
      aria-labelledby="today-buy-heading"
      className="rounded-2xl border border-opportunity/40 bg-gradient-to-br from-opportunity/10 via-card to-card p-6 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="technical-label text-opportunity-text">Buy signal</p>
        <span className="rounded-full bg-opportunity/15 px-2.5 py-1 text-xs font-medium text-opportunity-text">
          #1 best deal
        </span>
      </div>
      <h2
        id="today-buy-heading"
        className="mt-4 text-lg font-bold tracking-[-0.03em]"
      >
        A smart buy is waiting.
      </h2>
      <p className="mt-2 font-medium">{offer.gameName}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">
        {offer.price.toFixed(2)} {offer.currency}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {offer.store} · {offer.discountPercent === null ? "no discount" : `${offer.discountPercent}% off`} · fetched{" "}
        {formatFetchedAgo(offer.fetchedAt, new Date())}
      </p>
      <div className="mt-4 border-t border-border pt-4">
        <Link
          href={`/wishlist/${offer.wishlistEntryId}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          View wishlist offer
        </Link>
      </div>
    </aside>
  );
}

function BuySignalEmpty() {
  return (
    <aside className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="technical-label text-muted-foreground">Buy signal</p>
      <h2 className="mt-3 text-xl font-bold tracking-[-0.03em]">No fresh offers right now</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Nothing fresh and under target this cycle. Check the wishlist for current prices and targets.
      </p>
      <Link
        href="/wishlist"
        className="mt-5 w-fit text-sm font-medium text-signal-strong underline underline-offset-4 hover:text-foreground"
      >
        Open wishlist
      </Link>
    </aside>
  );
}

export function TodayHeroGrid({
  games,
  offers,
}: {
  games: readonly TodayHeroGame[];
  offers: readonly TodayOfferView[];
}) {
  const mainGame = games.find((game) => game.libraryEntry?.isMainGame === true) ?? null;
  const spotlightGame =
    mainGame ??
    games.find((game) => game.libraryEntry?.playState === "IN_PROGRESS") ??
    null;
  const bestOffer = offers[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
      {spotlightGame ? <Spotlight game={spotlightGame} /> : <SpotlightEmpty />}
      {bestOffer ? <BuySignal offer={bestOffer} /> : <BuySignalEmpty />}
    </div>
  );
}