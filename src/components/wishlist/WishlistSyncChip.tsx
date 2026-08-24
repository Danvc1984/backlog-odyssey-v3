import { prisma } from "@/lib/prisma";

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

  const date = new Date(summary.at);
  const formattedDate = Number.isNaN(date.getTime()) ? summary.at : date.toLocaleString();
  return (
    <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground" role="status">
      Last import: {summary.created} created, {summary.queuedReviews} reviews, {summary.enriched} enriched · {formattedDate}
    </div>
  );
}
