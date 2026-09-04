import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { PriceRefreshPanel } from "@/components/wishlist/PriceRefreshPanel";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { readCounts } from "@/lib/price-counts";

export interface PriceRefreshView {
  id: string;
  status: string;
  counts: unknown;
  requestedAt: Date;
  finishedAt: Date | null;
}

function statusTone(status: string): "ok" | "warning" | "neutral" {
  if (status === "SUCCEEDED" || status === "COMPLETED") return "ok";
  if (status === "FAILED") return "warning";
  return "neutral";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

export function PriceStatusCard({ lastRun }: { lastRun: PriceRefreshView | null }) {
  const counts = readCounts(lastRun?.counts ?? null);

  return (
    <SectionCard
      eyebrow="Provider maintenance"
      title="Prices"
      description="Global price refresh across the wishlist."
      status={
        lastRun ? (
          <StatusPill tone={statusTone(lastRun.status)}>{statusLabel(lastRun.status)}</StatusPill>
        ) : (
          <StatusPill tone="neutral">No run yet</StatusPill>
        )
      }
    >
      {lastRun ? (
        <div className="mb-4 space-y-1 rounded-lg border border-border p-4 text-sm">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              Total <span className="font-medium text-foreground">{counts.total}</span>
            </span>
            <span>
              Refreshed <span className="font-medium text-foreground">{counts.refreshed}</span>
            </span>
            <span>
              Not found <span className="font-medium text-foreground">{counts.notFound}</span>
            </span>
            <span>
              No offers <span className="font-medium text-foreground">{counts.noOffers}</span>
            </span>
            <span>
              Failed <span className="font-medium text-foreground">{counts.failed}</span>
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Requested {formatMexicoTimestamp(lastRun.requestedAt)}
            {lastRun.finishedAt
              ? ` · Finished ${formatMexicoTimestamp(lastRun.finishedAt)}`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">No price refresh yet.</p>
      )}
      <div className="flex justify-end">
        <PriceRefreshPanel />
      </div>
    </SectionCard>
  );
}
