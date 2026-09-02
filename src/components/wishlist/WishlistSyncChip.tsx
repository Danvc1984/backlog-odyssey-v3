import { prisma } from "@/lib/prisma";
import { formatMexicoTimestamp } from "@/lib/format-times";

interface WishlistImportSummary {
  at: string;
  created: number;
  queuedReviews: number;
  ignored: number;
  enriched: number;
}

function parseSummary(value: unknown): WishlistImportSummary | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const summary = (value as Record<string, unknown>).lastWishlistImport;
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) return null;
  const item = summary as Record<string, unknown>;
  if (
    typeof item.at !== "string" ||
    typeof item.created !== "number" ||
    typeof item.queuedReviews !== "number" ||
    typeof item.ignored !== "number" ||
    typeof item.enriched !== "number"
  ) return null;
  return {
    at: item.at,
    created: item.created,
    queuedReviews: item.queuedReviews,
    ignored: item.ignored,
    enriched: item.enriched,
  };
}

export async function WishlistSyncChip() {
  const connection = await prisma.steamConnection.findUnique({
    where: { id: 1 },
    select: { counts: true },
  });
  const summary = parseSummary(connection?.counts);
  if (!summary) return null;

  const formattedDate = formatMexicoTimestamp(summary.at) ?? summary.at;
  return (
    <div className="inline-flex min-h-9 items-center rounded-[8px] border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground" role="status">
      Last import: {summary.created} created, {summary.queuedReviews} reviews, {summary.enriched} enriched · {formattedDate}
    </div>
  );
}
