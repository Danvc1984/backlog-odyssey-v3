import type { TodayOperationsView } from "@/lib/today-operations";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "never";
}

export function TodayOperations({ view }: { view: TodayOperationsView }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Provider freshness and operations</h2>
      <div className="space-y-2 text-sm">
        <ul className="space-y-1">
          {view.providers.map((provider) => (
            <li key={provider.name}>{provider.name}: {formatDate(provider.lastSuccessAt)}</li>
          ))}
        </ul>
        <p>Enrichment jobs: {view.jobs.queued} queued, {view.jobs.running} running, {view.jobs.retryWait} retry-wait, {view.jobs.failed} failed.</p>
        {view.runningRuns.length > 0 ? (
          <ul className="space-y-1">
            {view.runningRuns.map((run, index) => <li key={`${run.kind}-${run.startedAt}-${index}`}>{run.kind}, started {formatDate(run.startedAt)}</li>)}
          </ul>
        ) : (
          <p className="text-muted-foreground">No background operations currently running.</p>
        )}
        <p className="text-muted-foreground">
          Manage services in <a href="/settings" className="underline underline-offset-4 hover:text-foreground">Settings</a>.
        </p>
      </div>
    </section>
  );
}
