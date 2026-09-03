import type { TodayOperationsView } from "@/lib/today-operations";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { StatusPill } from "@/components/ui/detail-card";

function OperationBlock({
  eyebrow,
  label,
  tone,
  detail,
}: {
  eyebrow: string;
  label: string;
  tone: "ok" | "warning" | "neutral";
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="technical-label text-muted-foreground">{eyebrow}</p>
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <div className="mt-2 text-sm">{detail}</div>
    </div>
  );
}

export function TodayOperations({ view }: { view: TodayOperationsView }) {
  const activeJobCount = view.jobs.queued + view.jobs.running + view.jobs.retryWait + view.jobs.failed;
  const operationsBusy = activeJobCount > 0 || view.runningRuns.length > 0;
  const allProvidersFresh = view.providers.every((provider) => provider.lastSuccessAt !== null);

  return (
    <div className="grid gap-4 md:grid-cols-3" aria-label="Operations status">
      <OperationBlock
        eyebrow="Background operations"
        label={operationsBusy ? "Busy" : "Quiet"}
        tone={operationsBusy ? "warning" : "ok"}
        detail={
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              {view.jobs.queued} queued · {view.jobs.running} running · {view.jobs.retryWait}{" "}
              retry-wait · {view.jobs.failed} failed
            </li>
            {view.runningRuns.map((run, index) => (
              <li key={`${run.kind}-${run.startedAt}-${index}`}>
                {run.kind}, started {formatMexicoTimestamp(run.startedAt)}
              </li>
            ))}
            {view.runningRuns.length === 0 && <li>No enrichment or sync jobs currently running.</li>}
          </ul>
        }
      />
      <OperationBlock
        eyebrow="Provider freshness"
        label={allProvidersFresh ? "All systems fresh" : "Check providers"}
        tone={allProvidersFresh ? "ok" : "warning"}
        detail={
          <ul className="space-y-1 text-xs text-muted-foreground">
            {view.providers.map((provider) => (
              <li key={provider.name} className="flex flex-wrap items-center justify-between gap-2">
                <span>{provider.name}</span>
                <span>{formatMexicoTimestamp(provider.lastSuccessAt) ?? "never"}</span>
              </li>
            ))}
          </ul>
        }
      />
      <OperationBlock
        eyebrow="Manage services"
        label="Settings"
        tone="neutral"
        detail={
          <p className="text-xs text-muted-foreground">
            Refreshes, compatibility sweeps, and provider queues are managed in{" "}
            <a href="/settings" className="underline underline-offset-4 hover:text-foreground">
              Settings
            </a>
            .
          </p>
        }
      />
    </div>
  );
}