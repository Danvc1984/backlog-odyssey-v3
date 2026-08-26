import Link from "next/link";
import { awayGameUrl } from "@/lib/away-api";
import { PROTONDB_APP_URL } from "@/lib/protondb-api";
import type { AntiCheatEvidence } from "@/lib/compat-evidence";
import type { WishlistCompatibilityEligibility } from "@/lib/wishlist-compatibility";
import { WishlistCompatRefreshButton } from "@/components/wishlist/WishlistCompatRefreshButton";

type Status =
  | "READY"
  | "READY_WITH_TINKERING"
  | "FALLBACK_RECOMMENDED"
  | "REQUIRED"
  | "UNKNOWN";
type ProtonDbTier = "native" | "platinum" | "gold" | "silver" | "bronze" | "borked";

interface EnvironmentRow {
  environment: string;
  status: string;
  source: string | null;
}

interface WishlistCompatibilityBlockProps {
  wishlistEntryId: string;
  eligibility: WishlistCompatibilityEligibility;
  protonDb: { tier: ProtonDbTier } | null;
  antiCheat: AntiCheatEvidence | null;
  environments: EnvironmentRow[];
  latestSnapshotAt: Date | null;
}

const STATUS_LABELS: Record<Status, string> = {
  READY: "Ready for Linux",
  READY_WITH_TINKERING: "Ready with tinkering",
  FALLBACK_RECOMMENDED: "May need fallback",
  REQUIRED: "Not playable",
  UNKNOWN: "Unknown",
};

const STATUS_CLASSES: Record<Status, string> = {
  READY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  READY_WITH_TINKERING: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  FALLBACK_RECOMMENDED: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  REQUIRED: "border-red-500/40 bg-red-500/10 text-red-200",
  UNKNOWN: "border-border bg-muted/40 text-muted-foreground",
};

const TIER_LABELS: Record<ProtonDbTier, string> = {
  native: "Native",
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  borked: "Borked",
};

const TIER_CLASSES: Record<ProtonDbTier, string> = {
  native: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  platinum: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  gold: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  silver: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  bronze: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  borked: "border-red-500/40 bg-red-500/10 text-red-200",
};

const AWAY_CLASSES: Record<AntiCheatEvidence["status"], string> = {
  Supported: STATUS_CLASSES.READY,
  Running: STATUS_CLASSES.READY,
  Planned: STATUS_CLASSES.READY_WITH_TINKERING,
  Denied: STATUS_CLASSES.REQUIRED,
  Broken: STATUS_CLASSES.REQUIRED,
};

const ENVIRONMENT_ORDER = ["BAZZITE", "WINDOWS"] as const;

const ENVIRONMENT_LABELS: Record<string, string> = {
  BAZZITE: "Bazzite",
  WINDOWS: "Windows",
};

const STALE_AFTER_DAYS = 180;

function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function statusBadge(status: string): React.ReactNode {
  return STATUS_LABELS[status as Status] ? (
    <Badge label={STATUS_LABELS[status as Status]} className={STATUS_CLASSES[status as Status]} />
  ) : (
    <Badge label="Unknown" className={STATUS_CLASSES.UNKNOWN} />
  );
}

function orderedEnvironments(rows: EnvironmentRow[]): EnvironmentRow[] {
  return ENVIRONMENT_ORDER.flatMap((environment) =>
    rows.filter((row) => row.environment === environment),
  );
}

export function WishlistCompatibilityBlock({
  wishlistEntryId,
  eligibility,
  protonDb,
  antiCheat,
  environments,
  latestSnapshotAt,
}: WishlistCompatibilityBlockProps) {
  if (!eligibility.eligible) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Compatibility
        </h2>
        <p className="text-sm text-muted-foreground">
          {eligibility.reason === "DLC"
            ? "Compatibility follows the owned base game."
            : "Compatibility appears once this wish has a confirmed Steam App ID."}
        </p>
      </section>
    );
  }

  const hasEvidence =
    protonDb !== null || antiCheat !== null || environments.length > 0;
  const age = latestSnapshotAt ? daysSince(latestSnapshotAt) : null;
  const stale = age !== null && age >= STALE_AFTER_DAYS;
  const appId = encodeURIComponent(eligibility.steamAppId);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Compatibility
        </h2>
        <div className="flex items-center gap-1.5">
          {age !== null && (
            <span
              className={`text-xs ${stale ? "text-amber-300" : "text-muted-foreground"}`}
              title={
                stale
                  ? "Older than the 180-day evidence window"
                  : undefined
              }
            >
              Evidence updated {age} {age === 1 ? "day" : "days"} ago
              {stale ? " - older than the 180-day window" : ""}
            </span>
          )}
          <WishlistCompatRefreshButton wishlistEntryId={wishlistEntryId} />
        </div>
      </div>

      {!hasEvidence ? (
        <p className="text-sm text-muted-foreground">Compatibility details not found.</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            {protonDb ? (
              <Badge
                label={`ProtonDB tier: ${TIER_LABELS[protonDb.tier]}`}
                className={TIER_CLASSES[protonDb.tier]}
              />
            ) : (
              <Badge label="No ProtonDB evidence" className={STATUS_CLASSES.UNKNOWN} />
            )}
            <Link
              href={`${PROTONDB_APP_URL}/${appId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              ProtonDB
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {antiCheat ? (
              <>
                <Badge
                  label={`Anti-cheat: ${antiCheat.status}`}
                  className={AWAY_CLASSES[antiCheat.status]}
                />
                {antiCheat.anticheats.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {antiCheat.anticheats.join(", ")}
                  </span>
                )}
                <Link
                  href={awayGameUrl(eligibility.steamAppId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Are we anti-cheat yet
                </Link>
              </>
            ) : (
              <Badge label="No anti-cheat evidence" className={STATUS_CLASSES.UNKNOWN} />
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {orderedEnvironments(environments).map((row) => (
              <div key={row.environment} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {ENVIRONMENT_LABELS[row.environment] ?? row.environment}
                  </span>
                  {statusBadge(row.status)}
                </div>
                {row.source && (
                  <p className="mt-1 text-xs text-muted-foreground">{row.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
