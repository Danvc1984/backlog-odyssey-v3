import { CurrentlyPlayingCarousel } from "@/components/today/CurrentlyPlayingCarousel";
import { TodayOperations } from "@/components/today/TodayOperations";
import type { TodayOperationsView } from "@/lib/today-operations";
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
  operations,
}: {
  activeBacklog: TodayDataHealth["activeBacklog"];
  operations: TodayOperationsView;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="technical-label text-muted-foreground">Backlog progress</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">
          {activeBacklog.completed} / {activeBacklog.total}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">played through</p>
      </div>
      <div>
        <p className="technical-label text-muted-foreground">In progress</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{activeBacklog.inProgress}</p>
        <p className="mt-1 text-xs text-muted-foreground">active campaigns</p>
      </div>
      <div className="col-span-full mt-2 border-t border-border pt-5">
        <TodayOperations view={operations} />
      </div>
    </div>
  );
}
