import Link from "next/link";
import { formatDescriptionPreview } from "@/lib/cover-presentation";
import { WishlistCover } from "@/components/wishlist/WishlistCover";
import { LibraryInterestRating } from "./LibraryInterestRating";
import { ProtonDbTag } from "./ProtonDbTag";
import { DeleteGameDialog } from "./DeleteGameDialog";
import { SourceIcon } from "@/components/sources/SourceIcon";
import { availabilitySourcePresentation } from "@/lib/sources/known-sources";
import type { CompatTag } from "@/lib/protondb-tags";
import type { LibraryCardMetadataView } from "@/lib/card-metadata-view";

export interface LibraryGameCardEntry {
  id: string;
  interest: number | null;
  playState: string;
  isMainGame: boolean;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
  createdAt: Date;
  compatTag: CompatTag;
  game: {
    id: string;
    name: string;
    type: string;
    baseGame: { id: string; name: string } | null;
    metadata: LibraryCardMetadataView | null;
    _count: { dlcs: number; tags: number };
    tags: { name: string }[];
    availability: {
      id: string;
      source: "STEAM" | "OTHER_PLATFORM" | "ROM";
      alternativeSource: { name: string } | null;
    }[];
  };
}

const EMPTY_COVER_ART_META: LibraryCardMetadataView = {
  imageUrl: null,
  genres: [],
  description: null,
  developers: [],
  releaseDate: null,
  rating: null,
  metacriticScore: null,
  playtimeHours: null,
  esrbName: null,
  wideImageUrl: null,
};

function formatPlaytime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}

function Cover({ entry, variant }: { entry: LibraryGameCardEntry; variant: "grid" | "list" }) {
  const imageUrl = (variant === "grid" ? entry.game.metadata?.imageUrl : entry.game.metadata?.wideImageUrl) ?? null;

  return (
    <WishlistCover
      id={entry.game.id}
      title={entry.game.name}
      imageUrl={imageUrl}
      href={`/games/${entry.game.id}`}
      className={variant === "list" ? "h-full min-h-44 w-full" : "aspect-[25/24]"}
      showTitle={variant === "grid"}
      fit={variant === "grid" ? "contain" : "cover"}
      backgroundBlur={variant === "grid" ? "blur-xl" : "blur-2xl"}
    />
  );
}

function MockActions({ gameId }: { gameId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 max-[1300px]:gap-1 max-[1300px]:[&_[data-slot=button]]:size-6 max-[1300px]:[&_[data-slot=button]_svg]:size-3">
      <Link
        href={`/games/${gameId}#personal-fields`}
        className="inline-flex h-7 items-center rounded-[8px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-card-alt max-[1300px]:h-6 max-[1300px]:px-1.5 max-[1300px]:text-[11px]"
      >
        Edit
      </Link>
      <Link
        href={`/games/${gameId}#play-state`}
        className="inline-flex h-7 items-center rounded-[8px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-card-alt max-[1300px]:h-6 max-[1300px]:px-1.5 max-[1300px]:text-[11px]"
      >
        <span className="max-[1100px]:hidden">Change state</span>
        <span className="hidden max-[1100px]:inline">State</span>
      </Link>
      <DeleteGameDialog gameId={gameId} trigger="icon" />
    </div>
  );
}

function CardMeta({ entry }: { entry: LibraryGameCardEntry }) {
  if (entry.game.type !== "BASE_GAME" || entry.game._count.dlcs === 0) return null;

  return (
    <span className="technical-label truncate text-muted-foreground" title={`${entry.game._count.dlcs} DLC`}>
      {entry.game._count.dlcs} DLC
    </span>
  );
}

function CardDetails({
  descriptionPreview,
  missingDescription,
  genres,
  developers,
  releaseDate,
  rating,
  metacriticScore,
  playtimeHours,
  esrbName,
  personalTags,
  availability,
  listView,
}: {
  descriptionPreview: string | null;
  missingDescription: boolean;
  genres: string[];
  developers: string[];
  releaseDate: string | null;
  rating: number | null;
  metacriticScore: number | null;
  playtimeHours: number | null;
  esrbName: string | null;
  personalTags: string[];
  availability: LibraryGameCardEntry["game"]["availability"];
  listView: boolean;
}) {
  const releaseYear = releaseDate?.slice(0, 4);
  const stats = [
    rating === null ? null : `IGDB total ${rating.toFixed(1)}`,
    metacriticScore === null ? null : `MC ${metacriticScore}`,
    esrbName ? `ESRB ${esrbName}` : null,
  ].filter((value): value is string => value !== null);
  const platforms = availability.map((platform) => ({
    ...availabilitySourcePresentation(platform.source, platform.alternativeSource?.name ?? null),
    key: platform.id,
  }));

  return (
    <div className={listView ? "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" : "mt-4 space-y-3"}>
      {descriptionPreview && (
        <p className="line-clamp-3 overflow-hidden text-sm leading-6 text-muted-foreground">
          {descriptionPreview}
        </p>
      )}
      {missingDescription && (
        <p className="text-xs text-warning-text">
          IGDB metadata is not available yet. Use Edit to search and choose a match.
        </p>
      )}
      {(genres.length > 0 || personalTags.length > 0 || playtimeHours !== null || platforms.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {genres.slice(0, 3).map((genre) => (
            <span key={`genre-${genre}`} className="rounded-md border border-border px-2 py-0.5 text-xs">
              {genre}
            </span>
          ))}
          {personalTags.map((tag) => (
            <span key={`tag-${tag}`} className="rounded-md border border-signal/30 bg-signal/5 px-2 py-0.5 text-xs text-signal-strong">
              {tag}
            </span>
          ))}
          {playtimeHours !== null && (
            <span className="rounded-md border border-border px-2 py-0.5 text-xs">
              {formatPlaytime(playtimeHours)}
            </span>
          )}
          {platforms.map((platform) => (
            <span key={platform.key} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <SourceIcon iconName={platform.iconName} brandIcon={platform.brandIcon} />
              <span>{platform.label}</span>
            </span>
          ))}
        </div>
      )}
      {listView && (developers.length > 0 || releaseYear || stats.length > 0) && (
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {developers[0] && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{developers[0]}</span>}
          {releaseYear && <span className="rounded-md border border-border px-2 py-0.5 text-xs">{releaseYear}</span>}
          {stats.map((stat) => (
            <span key={stat} className="rounded-md border border-border px-2 py-0.5 text-xs">{stat}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function CardBody({
  entry,
  variant,
  includeControls = true,
}: {
  entry: LibraryGameCardEntry;
  variant: "grid" | "list";
  includeControls?: boolean;
}) {
  const meta = entry.game.metadata ?? EMPTY_COVER_ART_META;
  const descriptionPreview = meta.description
    ? formatDescriptionPreview(meta.description)
    : null;
  const missingDescription = !meta.description?.trim();

  return (
    <div className={`flex min-w-0 flex-1 flex-col p-4 ${includeControls ? "" : "pt-0"}`}>
      {variant === "list" && includeControls && (
        <h3 className="mb-3 text-base font-bold leading-snug tracking-[-0.02em]">
          <Link href={`/games/${entry.game.id}`} className="hover:underline">
            {entry.game.name}
          </Link>
        </h3>
      )}
      {includeControls && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <LibraryInterestRating
              gameId={entry.game.id}
              gameName={entry.game.name}
              interest={entry.interest}
            />
            <div className="flex h-6 items-center">
              {entry.compatTag && (
                <Link
                  href={`/games/${entry.game.id}#compatibility`}
                  aria-label={`View compatibility for ${entry.game.name}`}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <ProtonDbTag tag={entry.compatTag} />
                </Link>
              )}
            </div>
          </div>
          <MockActions gameId={entry.game.id} />
        </div>
      )}
      <CardDetails
        descriptionPreview={descriptionPreview}
        missingDescription={missingDescription}
        genres={meta.genres}
        developers={meta.developers}
        releaseDate={meta.releaseDate}
        rating={meta.rating}
        metacriticScore={meta.metacriticScore}
        playtimeHours={meta.playtimeHours}
        esrbName={meta.esrbName}
        personalTags={entry.game.tags.map((tag) => tag.name)}
        availability={entry.game.availability}
        listView={variant === "list"}
      />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
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
      <article className="flex min-h-44 flex-col overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card sm:flex-row">
        <div className="h-40 w-full shrink-0 sm:h-auto sm:w-48 lg:w-64 xl:w-80 min-[1600px]:w-96">
          <Cover entry={entry} variant="list" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-3 p-4 pb-2 sm:flex-row sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h3 className="min-w-0 text-base font-bold leading-snug tracking-[-0.02em]">
                <Link href={`/games/${entry.game.id}`} className="hover:underline">
                  {entry.game.name}
                </Link>
              </h3>
              <div className="flex flex-col items-start gap-1">
                <LibraryInterestRating
                  gameId={entry.game.id}
                  gameName={entry.game.name}
                  interest={entry.interest}
                />
                <div className="flex h-6 items-center">
                  {entry.compatTag && (
                    <Link
                      href={`/games/${entry.game.id}#compatibility`}
                      aria-label={`View compatibility for ${entry.game.name}`}
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <ProtonDbTag tag={entry.compatTag} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto sm:shrink-0">
              <MockActions gameId={entry.game.id} />
            </div>
          </div>
          <div className="min-w-0">
            <CardBody entry={entry} variant="list" includeControls={false} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card">
      <Cover entry={entry} variant="grid" />
      <CardBody entry={entry} variant="grid" />
    </article>
  );
}
