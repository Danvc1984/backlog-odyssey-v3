"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  applyRawgTitle,
  cancelRawgEnrichment,
  loadMoreRawgCandidates,
  requestRawgMatchReview,
  requestRawgEnrichment,
  selectRawgMatch,
} from "@/actions/rawg-enrichment";
import { Button } from "@/components/ui/button";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import type { RawgEnrichmentJobView } from "@/lib/rawg-job-view";

interface RawgEnrichmentPanelProps {
  gameId: string;
  catalogName: string;
  initialJob: RawgEnrichmentJobView | null;
  hasRawgSnapshot: boolean;
  rawgTitle: string | null;
}

interface JobEndpointResult {
  success: boolean;
  data: RawgEnrichmentJobView | null;
  error: string | null;
}

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING", "RETRY_WAIT"]);
const CANDIDATES_PER_PAGE = 5;

function jobMessage(job: RawgEnrichmentJobView): string {
  switch (job.status) {
    case "QUEUED":
      return "Queued to contact RAWG.";
    case "RUNNING":
      return job.stage === "PERSISTING"
        ? "Saving matched RAWG metadata."
        : "Matching this game with RAWG.";
    case "RETRY_WAIT":
      return job.lastErrorMessage ?? "Waiting to retry RAWG.";
    case "AWAITING_MATCH":
      return "Choose the correct RAWG result to continue.";
    case "SUCCEEDED":
      return "RAWG metadata is up to date.";
    case "FAILED":
      return job.lastErrorMessage ?? "RAWG enrichment could not finish.";
  }
}

function retryCountdown(nextAttemptAt: string | null, now: number): string | null {
  if (!nextAttemptAt) return null;

  const seconds = Math.max(0, Math.ceil((new Date(nextAttemptAt).getTime() - now) / 1000));
  return seconds === 0 ? "Retrying now" : `Retrying in ${seconds}s`;
}

export function RawgEnrichmentPanel({
  gameId,
  catalogName,
  initialJob,
  hasRawgSnapshot,
  rawgTitle,
}: RawgEnrichmentPanelProps) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [pendingOverwrite, setPendingOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [candidatePageIndex, setCandidatePageIndex] = useState(0);
  const activeJobId = job?.id;
  const activeJobStatus = job?.status;
  const activeJobNextAttemptAt = job?.nextAttemptAt;

  const requestJobStatus = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/enrichment/rawg/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as JobEndpointResult;
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? "Failed to load RAWG enrichment status");
    }
    return result.data;
  }, []);

  const runJob = useCallback(
    async (jobId: string) => {
      setRunning(true);
      setError(null);
      try {
        const response = await fetch(`/api/enrichment/rawg/${encodeURIComponent(jobId)}`, {
          method: "POST",
        });
        const result = (await response.json()) as JobEndpointResult;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "Failed to run RAWG enrichment");
        }

        setJob(result.data);
        if (result.data.status === "SUCCEEDED") {
          router.refresh();
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to run RAWG enrichment");
      } finally {
        setRunning(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!activeJobId || !activeJobStatus || !ACTIVE_STATUSES.has(activeJobStatus)) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const latest = await requestJobStatus(activeJobId);
        if (cancelled) return;

        setJob(latest);
        const retryDue =
          latest.status === "RETRY_WAIT" &&
          (!latest.nextAttemptAt || new Date(latest.nextAttemptAt).getTime() <= Date.now());
        if (latest.status === "QUEUED" || retryDue) {
          await runJob(latest.id);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to poll RAWG enrichment");
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeJobId, activeJobNextAttemptAt, activeJobStatus, requestJobStatus, runJob]);

  useEffect(() => {
    if (job?.status !== "RETRY_WAIT") return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [job?.status]);

  const countdown = job?.status === "RETRY_WAIT" ? retryCountdown(job.nextAttemptAt, now) : null;
  const candidatePageCount =
    job?.status === "AWAITING_MATCH"
      ? Math.max(1, Math.ceil(job.candidates.length / CANDIDATES_PER_PAGE))
      : 1;
  const visibleCandidatePageIndex = Math.min(candidatePageIndex, candidatePageCount - 1);
  const visibleCandidates =
    job?.status === "AWAITING_MATCH"
      ? job.candidates.slice(
          visibleCandidatePageIndex * CANDIDATES_PER_PAGE,
          (visibleCandidatePageIndex + 1) * CANDIDATES_PER_PAGE,
        )
      : [];
  const hasPreviousCandidatePage = visibleCandidatePageIndex > 0;
  const hasNextCandidatePage =
    job?.status === "AWAITING_MATCH" &&
    (visibleCandidatePageIndex + 1) * CANDIDATES_PER_PAGE < job.candidates.length;

  const startEnrichment = async (confirmOverwrite: boolean) => {
    setRunning(true);
    setError(null);
    try {
      const result = await requestRawgEnrichment({ gameId, confirmOverwrite });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to queue RAWG enrichment");
      }
      if (result.data.kind === "OVERWRITE_REQUIRED") {
        setPendingOverwrite(true);
        return;
      }

      setPendingOverwrite(false);
      setJob(result.data.job);
      await runJob(result.data.job.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to queue RAWG enrichment");
    } finally {
      setRunning(false);
    }
  };

  const startMatchReview = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await requestRawgMatchReview({ gameId });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to search RAWG matches");
      }
      setPendingOverwrite(false);
      setCandidatePageIndex(0);
      setJob(result.data.job);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to search RAWG matches");
    } finally {
      setRunning(false);
    }
  };

  const chooseMatch = async (rawgId: number) => {
    if (!job) return;

    setRunning(true);
    setError(null);
    try {
      const result = await selectRawgMatch({ jobId: job.id, rawgId });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to select RAWG match");
      }

      setJob(result.data.job);
      await runJob(result.data.job.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to select RAWG match");
    } finally {
      setRunning(false);
    }
  };

  const nextCandidatePage = async () => {
    if (!job || job.status !== "AWAITING_MATCH") return;

    const nextStart = (visibleCandidatePageIndex + 1) * CANDIDATES_PER_PAGE;
    if (nextStart < job.candidates.length) {
      setCandidatePageIndex(visibleCandidatePageIndex + 1);
      return;
    }
    if (!job.hasMoreCandidates) return;

    setRunning(true);
    setError(null);
    try {
      const result = await loadMoreRawgCandidates({ jobId: job.id });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load more RAWG matches");
      }

      setJob(result.data.job);
      if (result.data.job.candidates.length > job.candidates.length) {
        setCandidatePageIndex(visibleCandidatePageIndex + 1);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load more RAWG matches");
    } finally {
      setRunning(false);
    }
  };

  const cancelMatchReview = async () => {
    if (!job) return;

    setRunning(true);
    setError(null);
    try {
      const result = await cancelRawgEnrichment({ jobId: job.id });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to cancel RAWG enrichment");
      }

      setJob(result.data.job);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to cancel RAWG enrichment");
    } finally {
      setRunning(false);
    }
  };

  const applyTitle = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await applyRawgTitle({ gameId });
      if (!result.success) {
        throw new Error(result.error ?? "Failed to apply RAWG title");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to apply RAWG title");
    } finally {
      setRunning(false);
    }
  };

  const canStart = !job || job.status === "SUCCEEDED" || job.status === "FAILED";

  return (
    <SectionCard
      eyebrow="Maintenance"
      title="Enrichment"
      id="rawg-enrichment-heading"
      description="Refresh matched game information without changing your catalog name automatically."
      status={<StatusPill tone={job?.status === "FAILED" ? "danger" : job ? "warning" : "neutral"}>{job?.status?.replaceAll("_", " ") ?? "Ready"}</StatusPill>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {canStart && !pendingOverwrite && !hasRawgSnapshot && (
            <Button type="button" size="sm" disabled={running} onClick={() => void startEnrichment(false)}>
              {running ? "Starting..." : "Load RAWG metadata"}
            </Button>
          )}
          {canStart && !pendingOverwrite && hasRawgSnapshot && (
            <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void startMatchReview()}>
              {running ? "Searching..." : "Choose another match"}
            </Button>
          )}
          {canStart && !pendingOverwrite && hasRawgSnapshot && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={running}
              onClick={() => void startEnrichment(false)}
              aria-label="Refresh RAWG metadata"
              title="Refresh RAWG metadata"
            >
              <RefreshCw aria-hidden="true" className={running ? "animate-spin" : undefined} />
            </Button>
          )}
        </div>
      </div>

      {rawgTitle && rawgTitle !== catalogName && (
        <div className="mt-4 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">RAWG title: {rawgTitle}</p>
          <p className="mt-1 text-muted-foreground">
            Use it only if it is a better catalog name for this game.
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-3" disabled={running} onClick={() => void applyTitle()}>
            Use RAWG title
          </Button>
        </div>
      )}

      {pendingOverwrite && (
        <div className="mt-4 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Replace the current RAWG metadata?</p>
          <p className="mt-1 text-muted-foreground">
            The current snapshot stays visible unless the replacement is successfully saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={running} onClick={() => void startEnrichment(true)}>
              {running ? "Starting..." : "Replace metadata"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => setPendingOverwrite(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {job && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p>{jobMessage(job)}</p>
            <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">
              {job.status.replaceAll("_", " ")}
            </span>
          </div>

          {(job.status === "QUEUED" || job.status === "RUNNING" || job.status === "RETRY_WAIT") && (
            <>
              <progress
                className="h-2 w-full overflow-hidden rounded-full"
                value={job.progress}
                max={100}
                aria-label="RAWG enrichment progress"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{job.progress}% complete</span>
                {countdown && <span>{countdown}</span>}
              </div>
            </>
          )}

          {job.status === "AWAITING_MATCH" && (
            <div className="grid gap-2">
              {visibleCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={running}
                  onClick={() => void chooseMatch(candidate.id)}
                  className="rounded-md border border-border p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block font-medium">{candidate.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {candidate.released ?? "Release date unavailable"}
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={running || !hasPreviousCandidatePage}
                  onClick={() => setCandidatePageIndex(Math.max(0, visibleCandidatePageIndex - 1))}
                >
                  Previous results
                </Button>
                {(hasNextCandidatePage || job.hasMoreCandidates) && (
                  <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void nextCandidatePage()}>
                    {hasNextCandidatePage ? "Next results" : "Load more results"}
                  </Button>
                )}
              </div>
              <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void cancelMatchReview()}>
                None of these match
              </Button>
            </div>
          )}

          {job.status === "FAILED" && (
            <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => void startEnrichment(false)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </SectionCard>
  );
}
