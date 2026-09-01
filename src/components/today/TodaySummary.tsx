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
    <section className="rounded-xl border border-border bg-card p-4">
      <p className="technical-label text-muted-foreground">Data health</p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <p><span className="font-medium text-foreground">{activeBacklog.playedBefore}</span> of {activeBacklog.total} played through</p>
        <p><span className="font-medium text-foreground">{activeBacklog.inProgress}</span> in progress</p>
        <p><span className="font-medium text-foreground">{abandoned}</span> abandoned</p>
      </div>
    </section>
  );
}
