import Link from "next/link";
import { Star, Clock, RotateCcw, EyeOff } from "lucide-react";
import { gradientFor } from "@/lib/cover-gradient";
import { availabilitySourcePresentation } from "@/lib/sources/known-sources";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { cn } from "@/lib/utils";

export interface LibraryGameCardEntry {
  id: string;
  playState: string;
  isMainGame: boolean;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
  createdAt: Date;
  game: {
    id: string;
    name: string;
    type: string;
    baseGame: { id: string; name: string } | null;
    metadataSnapshots: { id: string; payload?: unknown }[];
    _count: { dlcs: number; collections: number };
    availability: {
      id: string;
      source: "STEAM" | "OTHER_PLATFORM" | "ROM";
      alternativeSource: { name: string } | null;
    }[];
  };
}

const PLAY_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PLAYED_BEFORE: "Played before",
  ABANDONED: "Abandoned",
};

interface CoverArtMeta {
  genres: string[];
  developers: string[];
  releaseDate: string | null;
  rating: number | null;
  metacriticScore: number | null;
  playtimeHours: number | null;
  esrbName: string | null;
}

function extractCoverArtMeta(snapshots: readonly { payload?: unknown }[]): CoverArtMeta {
  for (const snapshot of snapshots) {
    const payload = snapshot.payload;
    if (typeof payload !== "object" || payload === null) continue;
    const record = payload as Record<string, unknown>;
    const stringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const esrb = record.esrbRating;
    return {
      genres: stringArray(record.genres),
      developers: stringArray(record.developers),
      releaseDate: typeof record.releaseDate === "string" ? record.releaseDate : null,
      rating: typeof record.rating === "number" ? record.rating : null,
      metacriticScore: typeof record.metacriticScore === "number" ? record.metacriticScore : null,
      playtimeHours: typeof record.playtimeHours === "number" ? record.playtimeHours : null,
      esrbName:
        typeof esrb === "object" && esrb !== null && typeof (esrb as { name?: unknown }).name === "string"
          ? (esrb as { name: string }).name
          : null,
    };
  }
  return {
    genres: [],
    developers: [],
    releaseDate: null,
    rating: null,
    metacriticScore: null,
    playtimeHours: null,
    esrbName: null,
  };
}

function Cover({ entry, compact }: { entry: LibraryGameCardEntry; compact: boolean }) {
  return (
    <Link
      href={`/games/${entry.game.id}`}
      className={`relative block overflow-hidden bg-gradient-to-br ${gradientFor(entry.game.id)} ${
        compact ? "w-24 shrink-0 sm:w-28" : "w-full"
      }`}
      aria-hidden
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
      <div className={compact ? "relative h-full min-h-28" : "relative min-h-16"} />
    </Link>
  );
}

function CardMeta({ entry }: { entry: LibraryGameCardEntry }) {
  const notEmpty: string[] = [];
  const metaReady = entry.game.metadataSnapshots.length > 0;
  if (entry.game.type === "BASE_GAME" && entry.game._count.dlcs > 0) {
    notEmpty.push(`${entry.game._count.dlcs} DLC`);
  }
  if (entry.game._count.collections > 0) {
    notEmpty.push(
      `${entry.game._count.collections} ${entry.game._count.collections === 1 ? "collection" : "collections"}`,
    );
  }

  const status = metaReady ? (
    <span className={cn("technical-label", "text-muted-foreground")}>meta ready</span>
  ) : (
    <span className={cn("technical-label", "text-warning-text")}>meta missing</span>
  );

  const counts =
    notEmpty.length > 0 ? (
      <span
        className="technical-label truncate text-muted-foreground"
        title={notEmpty.join(" · ")}
      >
        {notEmpty.join(" · ")}
      </span>
    ) : null;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {counts}
      {status}
    </span>
  );
}

function formatReleaseYear(value: string): string {
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : value;
}

function formatPlaytime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function CardHeader({ entry }: { entry: LibraryGameCardEntry }) {
  return (
    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-bold leading-snug tracking-[-0.02em]">
        <Link href={`/games/${entry.game.id}`} className="hover:underline">
          {entry.game.name}
        </Link>
      </h3>
      {entry.game.type === "DLC" && entry.game.baseGame && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          DLC for{" "}
          <Link href={`/games/${entry.game.baseGame.id}`} className="hover:underline">
            {entry.game.baseGame.name}
          </Link>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {entry.isMainGame && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            <Star className="size-3" />
            Main game
          </span>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {PLAY_STATE_LABELS[entry.playState] ?? entry.playState}
        </span>
        {entry.playSoon && (
          <span className="inline-flex items-center gap-1 rounded-full bg-opportunity/15 px-2 py-0.5 text-xs font-medium text-opportunity-text">
            <Clock className="size-3" />
            Play soon
          </span>
        )}
        {entry.replayCandidate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <RotateCcw className="size-3" />
            Replay
          </span>
        )}
        {entry.hidden && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <EyeOff className="size-3" />
            Hidden
          </span>
        )}
      </div>
    </div>
  );
}

function CardDetails({
  entry,
  genreLine,
  developerLine,
  releaseYear,
  stats,
  horizontal,
  showStats,
}: {
  entry: LibraryGameCardEntry;
  genreLine: string | null;
  developerLine: string | null;
  releaseYear: string | null;
  stats: string[];
  horizontal: boolean;
  showStats: boolean;
}) {
  const creditRow =
    genreLine || developerLine || releaseYear ? (
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        {genreLine && <span>{genreLine}</span>}
        {developerLine && (
          <span>
            {genreLine && <span aria-hidden className="mx-0.5 text-border-strong">/</span>}
            {developerLine}
          </span>
        )}
        {releaseYear && (
          <span>
            {(genreLine || developerLine) && (
              <span aria-hidden className="mx-0.5 text-border-strong">/</span>
            )}
            {releaseYear}
          </span>
        )}
      </span>
    ) : null;

  const statsRow =
    showStats && stats.length > 0 ? (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {stats.map((stat, index) => (
          <span key={stat} className="flex items-center gap-x-2">
            {index > 0 && <span aria-hidden className="text-muted-foreground/50">·</span>}
            {stat}
          </span>
        ))}
      </span>
    ) : null;

  const sourceRow =
    entry.game.availability.length === 0 ? (
      <span className="text-xs text-muted-foreground">No sources</span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {entry.game.availability.map((availability) => {
          const presentation = availabilitySourcePresentation(
            availability.source,
            availability.alternativeSource?.name ?? null,
          );
          return (
            <span
              key={availability.id}
              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              <SourceIcon iconName={presentation.iconName} />
              {presentation.label}
            </span>
          );
        })}
      </span>
    );

  const groups = [sourceRow, creditRow, statsRow].filter((node) => node !== null);

  if (horizontal) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 sm:max-w-md sm:justify-end">
        {groups.map((group, index) => (
          <span key={index} className="flex items-center gap-x-2.5">
            {index > 0 && <span aria-hidden className="text-muted-foreground/40">·</span>}
            {group}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {groups.map((group, index) => (
        <span key={index} className="flex items-center gap-x-3">
          {index > 0 && <span aria-hidden className="text-muted-foreground/40">·</span>}
          {group}
        </span>
      ))}
    </div>
  );
}

function CardBody({
  entry,
  layout,
}: {
  entry: LibraryGameCardEntry;
  layout: "grid" | "list";
}) {
  const meta = extractCoverArtMeta(entry.game.metadataSnapshots);
  const genreLine = meta.genres.length > 0 ? meta.genres.slice(0, 2).join(" · ") : null;
  const developerLine = meta.developers[0] ?? null;
  const releaseYear = meta.releaseDate ? formatReleaseYear(meta.releaseDate) : null;

  const stats: string[] = [];
  if (meta.rating !== null) stats.push(`★ ${meta.rating.toFixed(1)}`);
  if (meta.metacriticScore !== null) stats.push(`MC ${meta.metacriticScore}`);
  if (meta.playtimeHours !== null) stats.push(`⏱ ${formatPlaytime(meta.playtimeHours)}`);
  if (meta.esrbName !== null) stats.push(`ESRB ${meta.esrbName}`);

  if (layout === "list") {
    return (
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <CardHeader entry={entry} />
          <CardDetails
            entry={entry}
            genreLine={genreLine}
            developerLine={developerLine}
            releaseYear={releaseYear}
            stats={stats}
            horizontal
            showStats
          />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <Link
            href={`/games/${entry.game.id}`}
            className="text-sm font-medium text-signal-strong hover:text-foreground"
          >
            Open detail ↗
          </Link>
          <CardMeta entry={entry} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col p-4">
      <CardHeader entry={entry} />
      <CardDetails
        entry={entry}
        genreLine={genreLine}
        developerLine={developerLine}
        releaseYear={releaseYear}
        stats={stats}
        horizontal={false}
        showStats={false}
      />
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <Link
          href={`/games/${entry.game.id}`}
          className="text-sm font-medium text-signal-strong hover:text-foreground"
        >
          Open detail ↗
        </Link>
        <CardMeta entry={entry} />
      </div>
    </div>
  );
}

export function LibraryGameCard({
  entry,
  variant = "grid",
}: {
  entry: LibraryGameCardEntry;
  variant?: "grid" | "list";
}) {
  if (variant === "list") {
    return (
      <article className="flex overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Cover entry={entry} compact />
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1">
            <CardBody entry={entry} layout="list" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <Cover entry={entry} compact={false} />
      <CardBody entry={entry} layout="grid" />
    </article>
  );
}