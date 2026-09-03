import Link from "next/link";
import type { SteamActivityView } from "@/lib/steam-activity";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { DetailHeroArt } from "@/components/ui/detail-hero-art";

export type ActivityCatalog = Map<string, { gameId: string; imageUrl: string | null }>;

function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function RecentSteamActivity({
  view,
  catalog,
}: {
  view: SteamActivityView;
  catalog: ActivityCatalog;
}) {
  if (view.state === "NO_CONNECTION") {
    return (
      <p className="text-sm text-muted-foreground">
        <a href="/settings#steam-connection-card" className="underline underline-offset-4 hover:text-foreground">
          Connect Steam
        </a>{" "}
        to see your recent activity here.
      </p>
    );
  }

  if (view.state === "FRESH_EMPTY") {
    return (
      <p className="text-sm text-muted-foreground">
        No recent Steam activity. Games you played in the last two weeks will appear here.
      </p>
    );
  }

  const rows = [...view.imported, ...view.unimported];

  return (
    <div>
      {view.state === "STALE_ERROR" && (
        <p className="mb-3 max-w-2xl text-sm text-amber-300">
          {view.errorMessage}
          {view.checkedAt && formatMexicoTimestamp(view.checkedAt)
            ? ` Showing results from ${formatMexicoTimestamp(view.checkedAt)}.`
            : null}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recent Steam activity. Games you played in the last two weeks will appear here.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => {
            const imported = view.imported.includes(row);
            const match = catalog.get(row.steamAppId);
            return (
              <li
                key={row.steamAppId}
                className="relative flex h-28 items-end overflow-hidden rounded-lg border border-border shadow-card"
              >
                <DetailHeroArt
                  id={row.steamAppId}
                  title={row.name}
                  imageUrl={match?.imageUrl ?? null}
                  hideLabel
                  className="absolute inset-0"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
                  aria-hidden="true"
                />
                <div className="relative z-10 flex w-full items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {match ? (
                        <Link
                          href={`/games/${match.gameId}`}
                          className="font-medium text-white drop-shadow-sm hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-white drop-shadow-sm">{row.name}</span>
                      )}
                      {!imported && (
                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs text-white">
                          not in library
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/85">
                      {row.lastPlayedAt && formatMexicoTimestamp(row.lastPlayedAt) && (
                        <span>played {formatMexicoTimestamp(row.lastPlayedAt)}</span>
                      )}
                      <span>{formatPlaytime(row.playtimeForeverMinutes)}</span>
                      {!imported && (
                        <a
                          href="/settings#steam-connection-card"
                          className="underline underline-offset-4 hover:text-white"
                        >
                          sync from Settings
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}