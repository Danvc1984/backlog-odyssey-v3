import type { SteamActivityView } from "@/lib/steam-activity";

function formatDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function RecentSteamActivity({ view }: { view: SteamActivityView }) {
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
          {view.checkedAt && ` Showing results from ${formatDate(view.checkedAt)}.`}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recent Steam activity. Games you played in the last two weeks will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const imported = view.imported.includes(row);
            return (
              <li key={row.steamAppId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className={imported ? "" : "text-muted-foreground"}>
                  {row.name}
                  {!imported && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      not in library
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                  {row.lastPlayedAt && <span>played {formatDate(new Date(row.lastPlayedAt))}</span>}
                  <span>{formatPlaytime(row.playtimeForeverMinutes)}</span>
                  {!imported && (
                    <a
                      href="/settings#steam-connection-card"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      sync from Settings
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}