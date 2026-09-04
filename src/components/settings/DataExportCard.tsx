import { Download } from "lucide-react";
import { SectionCard } from "@/components/ui/detail-card";
import { Button } from "@/components/ui/button";

export function DataExportCard({
  gameCount,
  wishlistCount,
  recommendationRunCount,
}: {
  gameCount: number;
  wishlistCount: number;
  recommendationRunCount: number;
}) {
  return (
    <SectionCard
      eyebrow="Data"
      title="Personal-data export"
      description="Download your catalog, wishlist, and platform decisions as a JSON file. Provider snapshots, offers, and run records are excluded."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{gameCount}</span> games ·{" "}
          <span className="font-medium text-foreground">{wishlistCount}</span> wishlist
          entries · <span className="font-medium text-foreground">{recommendationRunCount}</span>{" "}
          recommendation runs
        </p>
        <a href="/api/export" download>
          <Button type="button" variant="outline" size="sm">
            <Download aria-hidden className="size-4" />
            Download export
          </Button>
        </a>
      </div>
    </SectionCard>
  );
}
