import Link from "next/link";
import type { TodayDataHealth } from "@/lib/today-data-health";

interface TodaySummaryGame {
  id: string;
  name: string;
  libraryEntry: {
    isMainGame: boolean;
    playState: string;
  } | null;
}

interface TodaySummaryProps {
  games: readonly TodaySummaryGame[];
  activeBacklog: TodayDataHealth["activeBacklog"];
  abandoned: number;
}

export function TodaySummary({ games, activeBacklog, abandoned }: TodaySummaryProps) {
  const mainGame = games.find((game) => game.libraryEntry?.isMainGame);
  const inProgressGames = games.filter(
    (game) => game.libraryEntry?.playState === "IN_PROGRESS" && game.id !== mainGame?.id,
  );

  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Current games
        </h2>
        {mainGame ? (
          <p className="text-sm">
            Main game: <Link href={`/games/${mainGame.id}`} className="font-medium hover:underline">{mainGame.name}</Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No main game selected. <Link href="/library" className="underline underline-offset-4 hover:text-foreground">Choose one from your library</Link>.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">In progress</h3>
        {inProgressGames.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {inProgressGames.map((game) => (
              <li key={game.id}>
                <Link href={`/games/${game.id}`} className="hover:underline">{game.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing in progress.</p>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          {activeBacklog.playedBefore} of {activeBacklog.total} played through
        </p>
        <p>{abandoned} abandoned</p>
      </div>
    </section>
  );
}
