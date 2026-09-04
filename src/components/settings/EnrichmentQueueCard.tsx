import Link from "next/link";
import { SectionCard } from "@/components/ui/detail-card";
import { EnrichmentRetryButton } from "@/components/settings/EnrichmentRetryButton";

export interface EnrichmentQueueJobView {
  id: string;
  provider: string;
  status: string;
  stage: string;
  error: string | null;
  finishedAt: Date | null;
  gameId: string;
  gameName: string;
}

const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "RETRY_WAIT"];
const RETRYABLE_PROVIDERS = ["RAWG", "PROTONDB", "ARE_WE_ANTICHEAT_YET"];

export function EnrichmentQueueCard({
  jobs,
}: {
  jobs: EnrichmentQueueJobView[];
}) {
  const active = jobs.filter((job) => ACTIVE_STATUSES.includes(job.status));
  const activeByProvider = (provider: string) =>
    active.filter((job) => job.provider === provider).length;
  const failed = jobs
    .filter((job) => job.status === "FAILED")
    .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));
  const failedList = failed.slice(0, 10);
  const queueEmpty = jobs.length === 0;

  return (
    <SectionCard
      eyebrow="Provider maintenance"
      title="Enrichment queue"
      description="Pending and failed provider jobs for owned and wishlist games."
    >
      {queueEmpty ? (
        <p className="text-sm text-muted-foreground">The enrichment queue is clear.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">RAWG</p>
              <p className="mt-1 text-lg font-semibold">{activeByProvider("RAWG")} active</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">ProtonDB</p>
              <p className="mt-1 text-lg font-semibold">{activeByProvider("PROTONDB")} active</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">AWAY</p>
              <p className="mt-1 text-lg font-semibold">{activeByProvider("ARE_WE_ANTICHEAT_YET")} active</p>
            </div>
          </div>
          {failedList.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {failedList.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/games/${job.gameId}`}
                      className="block font-medium text-foreground hover:underline"
                    >
                      {job.gameName}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {job.provider.replaceAll("_", " ").toLowerCase()}
                      {job.error ? ` - ${job.error}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {RETRYABLE_PROVIDERS.includes(job.provider) ? (
                      <EnrichmentRetryButton jobId={job.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No failed jobs.</p>
          )}
        </>
      )}
    </SectionCard>
  );
}
