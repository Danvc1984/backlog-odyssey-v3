import { CurrentlyPlayingCarousel } from "@/components/today/CurrentlyPlayingCarousel";
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
}

export function TodaySummary({ games }: TodaySummaryProps) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Currently playing
        </h2>
        <CurrentlyPlayingCarousel games={games} />
      </div>

    </section>
  );
}

export function TodayDataHealth({
  activeBacklog,
  abandoned,
}: {
  activeBacklog: TodayDataHealth["activeBacklog"];
  abandoned: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <p className="technical-label text-muted-foreground">Backlog progress</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">
          {activeBacklog.playedBefore} / {activeBacklog.total}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">played through</p>
      </div>
      <div>
        <p className="technical-label text-muted-foreground">In progress</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{activeBacklog.inProgress}</p>
        <p className="mt-1 text-xs text-muted-foreground">active campaigns</p>
      </div>
      <div>
        <p className="technical-label text-muted-foreground">Abandoned</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{abandoned}</p>
        <p className="mt-1 text-xs text-muted-foreground">set aside</p>
      </div>
    </div>
  );
}
