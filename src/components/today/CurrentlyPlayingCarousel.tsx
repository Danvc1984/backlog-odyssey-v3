import Link from "next/link";
import { Carousel } from "@/components/today/Carousel";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";

interface CurrentlyPlayingGame {
  id: string;
  name: string;
  libraryEntry: {
    isMainGame: boolean;
    playState: string;
  } | null;
}

function playStateLabel(playState: string): string {
  return playState === "IN_PROGRESS" ? "In progress" : playState.replaceAll("_", " ").toLowerCase();
}

function GameSlide({ game }: { game: CurrentlyPlayingGame }) {
  const isMainGame = game.libraryEntry?.isMainGame === true;
  return (
    <article className="relative overflow-hidden rounded-2xl bg-card p-6 text-white shadow-card">
      <DetailHeroArt
        id={game.id}
        title={game.name}
        imageUrl={null}
        hideLabel
        className="absolute inset-0 h-full"
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
      <div className="relative min-h-52 max-w-2xl">
        <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider">
          {isMainGame && <span className="rounded-full bg-white/20 px-2.5 py-1">Main game</span>}
          {game.libraryEntry?.playState && (
            <span className="rounded-full bg-black/20 px-2.5 py-1">
              {playStateLabel(game.libraryEntry.playState)}
            </span>
          )}
        </div>
        <div className="flex min-h-44 items-end">
          <Link href={`/games/${game.id}`} className="font-display text-4xl font-semibold tracking-tight hover:underline">
            {game.name}
          </Link>
        </div>
        <p className="technical-label text-white/70">Currently playing</p>
      </div>
    </article>
  );
}

function EmptySlide() {
  return (
    <article className="rounded-2xl border border-dashed border-border bg-card p-6">
      <div className="flex min-h-52 flex-col justify-center">
        <p className="technical-label text-muted-foreground">Currently playing</p>
        <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight">Nothing queued here yet</h3>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Choose a main game or mark a title in progress to keep it close at hand.
        </p>
        <Link href="/library" className="mt-5 w-fit text-sm font-medium text-signal-strong underline underline-offset-4 hover:text-foreground">
          Open library
        </Link>
      </div>
    </article>
  );
}

export function CurrentlyPlayingCarousel({ games }: { games: readonly CurrentlyPlayingGame[] }) {
  const mainGame = games.find((game) => game.libraryEntry?.isMainGame === true);
  const inProgressGames = games
    .filter((game) => game.libraryEntry?.playState === "IN_PROGRESS" && game.id !== mainGame?.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const orderedGames = mainGame ? [mainGame, ...inProgressGames] : inProgressGames;
  const slides = orderedGames.length > 0
    ? orderedGames.map((game) => <GameSlide key={game.id} game={game} />)
    : [<EmptySlide key="empty" />];

  return <Carousel label="Currently playing" slides={slides} />;
}
