"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshGameCompatibility, setCompatOverride } from "@/actions/compatibility";
import { deriveWindowsFallback, type AntiCheatStatus } from "@/lib/compat-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "READY" | "READY_WITH_TINKERING" | "FALLBACK_RECOMMENDED" | "REQUIRED" | "UNKNOWN";
type ProtonDbTier = "native" | "platinum" | "gold" | "silver" | "bronze" | "borked";

interface ProtonDbEvidence {
  status: Status;
  tier: ProtonDbTier;
}

interface AntiCheatEvidence {
  status: Exclude<AntiCheatStatus, null>;
  anticheats: string[];
}

interface CompatibilitySectionProps {
  gameId: string;
  gameName: string;
  hasSteamIdentity: boolean;
  isRomOnly: boolean;
  latestSnapshotAt: Date | null;
  protonDb: ProtonDbEvidence | null;
  protonDbUrl: string | null;
  antiCheat: AntiCheatEvidence | null;
  awayUrl: string | null;
  override: { status: Status; reason: string | null } | null;
  job: { status: string; progress: number; lastErrorMessage: string | null } | null;
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

const AWAY_CLASSES: Record<Exclude<AntiCheatStatus, null>, string> = {
  Supported: STATUS_CLASSES.READY,
  Running: STATUS_CLASSES.READY,
  Planned: STATUS_CLASSES.READY_WITH_TINKERING,
  Denied: STATUS_CLASSES.REQUIRED,
  Broken: STATUS_CLASSES.REQUIRED,
};

function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function ProtonDbTier({ protonDb }: { protonDb: ProtonDbEvidence | null }) {
  if (!protonDb) return null;
  return <Badge label={`ProtonDB tier: ${TIER_LABELS[protonDb.tier]}`} className={TIER_CLASSES[protonDb.tier]} />;
}

export function CompatibilitySection({
  gameId,
  gameName,
  hasSteamIdentity,
  isRomOnly,
  latestSnapshotAt,
  protonDb,
  protonDbUrl,
  antiCheat,
  awayUrl,
  override,
  job,
}: CompatibilitySectionProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [editingOverride, setEditingOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<Status>(override?.status ?? "READY");
  const [overrideReason, setOverrideReason] = useState(override?.reason ?? "");
  const [savingOverride, setSavingOverride] = useState(false);
  const age = latestSnapshotAt ? daysSince(latestSnapshotAt) : null;
  const bazziteStatus = override?.status ?? protonDb?.status ?? "UNKNOWN";
  const windowsFallback = deriveWindowsFallback(bazziteStatus, antiCheat?.status ?? null);
  const antiCheatBlocksLinux = antiCheat?.status === "Denied" || antiCheat?.status === "Broken";

  const refresh = async () => {
    setRefreshing(true);
    const result = await refreshGameCompatibility({ gameId });
    setRefreshing(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to refresh compatibility");
      return;
    }
    toast.success(`Compatibility refresh started for "${gameName}"`);
    router.refresh();
  };

  const saveOverride = async () => {
    setSavingOverride(true);
    const result = await setCompatOverride({ gameId, status: overrideStatus, reason: overrideReason || null });
    setSavingOverride(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save override");
      return;
    }
    setEditingOverride(false);
    toast.success("Bazzite override saved");
    router.refresh();
  };

  const clearOverride = async () => {
    setSavingOverride(true);
    const result = await setCompatOverride({ gameId, status: null, reason: null });
    setSavingOverride(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to clear override");
      return;
    }
    toast.success("Bazzite override cleared");
    router.refresh();
  };

  return (
    <section className="space-y-3" aria-label="Compatibility">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Compatibility</h2>
          {age !== null && (
            <p className={`mt-1 text-xs ${age > 150 ? "text-amber-300" : "text-muted-foreground"}`}>
              Updated {age} days ago
            </p>
          )}
          {protonDbUrl && (
            <a className="mt-1 block text-xs text-primary underline-offset-4 hover:underline" href={protonDbUrl} target="_blank" rel="noreferrer">
              View this game on ProtonDB
            </a>
          )}
        </div>
        {!isRomOnly && hasSteamIdentity && (
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw aria-hidden className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </div>

      {isRomOnly ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Compatibility is not applicable to ROM-only games.
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Bazzite</p>
              <p className="text-xs text-muted-foreground">{override ? "Primary: Bazzite personal override" : "Primary: ProtonDB"}</p>
              {antiCheat ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Secondary: anti-cheat</span>
                  <Badge label={`AWAY: ${antiCheat.status}`} className={AWAY_CLASSES[antiCheat.status]} />
                  {antiCheat.anticheats.length > 0 && <span>{antiCheat.anticheats.join(", ")}</span>}
                  {awayUrl && <a className="text-primary underline-offset-4 hover:underline" href={awayUrl} target="_blank" rel="noreferrer">View AWAY game page</a>}
                </div>
              ) : <p className="text-xs text-muted-foreground">Secondary: anti-cheat evidence unavailable</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              <Badge label={STATUS_LABELS[bazziteStatus]} className={STATUS_CLASSES[bazziteStatus]} />
              <ProtonDbTier protonDb={protonDb} />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Windows</p>
              <p className="text-xs text-muted-foreground">{windowsFallback.source}</p>
            </div>
            <Badge label={windowsFallback.label} className={STATUS_CLASSES[windowsFallback.status]} />
          </div>
        </div>
      )}

      {!hasSteamIdentity && !isRomOnly && (
        <p className="text-xs text-muted-foreground">Add a Steam App ID above to look up compatibility evidence.</p>
      )}
      {antiCheatBlocksLinux && !isRomOnly && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          Anti-cheat warning: AreWeAntiCheatYet reports {antiCheat?.status}.
        </p>
      )}
      {job && ["QUEUED", "RUNNING", "RETRY_WAIT"].includes(job.status) && (
        <p className="text-xs text-muted-foreground">Refresh {job.status.toLowerCase().replace("_", " ")} ({job.progress}%).</p>
      )}
      {job?.status === "FAILED" && <p className="text-xs text-destructive">{job.lastErrorMessage}</p>}

      {override && !isRomOnly && !editingOverride && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p>Bazzite override reason: {override.reason || "No reason provided"}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingOverride(true)} disabled={savingOverride}>
              Edit Bazzite override
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void clearOverride()} disabled={savingOverride}>
              Clear Bazzite override
            </Button>
          </div>
        </div>
      )}
      {!override && !isRomOnly && !editingOverride && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingOverride(true)}>
          Set Bazzite override
        </Button>
      )}
      {editingOverride && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Select value={overrideStatus} onValueChange={(value) => setOverrideStatus(value as Status)}>
            <SelectTrigger aria-label="Bazzite override compatibility status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why does this Bazzite override apply?" aria-label="Bazzite override reason" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void saveOverride()} disabled={savingOverride}>{savingOverride ? "Saving..." : "Save Bazzite override"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingOverride(false)} disabled={savingOverride}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}
