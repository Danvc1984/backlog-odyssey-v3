import Link from "next/link";
import { formatDescriptionPreview } from "@/lib/cover-presentation";
import { WishlistCover } from "@/components/wishlist/WishlistCover";
import { LibraryInterestRating } from "./LibraryInterestRating";
import { ProtonDbTag } from "./ProtonDbTag";
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
    _count: { dlcs: number; collections: number };
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
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/games/${gameId}#personal-fields`}
        className="inline-flex h-7 items-center rounded-[8px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-card-alt"
      >
        Edit
      </Link>
      <Link
        href={`/games/${gameId}#play-state`}
        className="inline-flex h-7 items-center rounded-[8px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground hover:bg-card-alt"
      >
        Change state
      </Link>
    </div>
  );
}

function CardMeta({ entry }: { entry: LibraryGameCardEntry }) {
  const notEmpty: string[] = [];
  if (entry.game.type === "BASE_GAME" && entry.game._count.dlcs > 0) {
    notEmpty.push(`${entry.game._count.dlcs} DLC`);
  }
  if (entry.game._count.collections > 0) {
    notEmpty.push(
      `${entry.game._count.collections} ${entry.game._count.collections === 1 ? "collection" : "collections"}`,
    );
  }

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
  listView: boolean;
}) {
  const releaseYear = releaseDate?.slice(0, 4);
  const stats = [
    rating === null ? null : `IGDB total ${rating.toFixed(1)}`,
    metacriticScore === null ? null : `MC ${metacriticScore}`,
    playtimeHours === null ? null : formatPlaytime(playtimeHours),
    esrbName ? `ESRB ${esrbName}` : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className={listView ? "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" : "mt-4 space-y-3"}>
      {descriptionPreview && !listView && (
        <div className={listView ? "block" : "hidden sm:block"}>
          <p
            className="line-clamp-3 overflow-hidden leading-6 text-muted-foreground"
          >
            {descriptionPreview}
          </p>
        </div>
      )}
      {missingDescription && (
        <p className="text-xs text-warning-text">
          IGDB metadata is not available yet. Use Edit to search and choose a match.
        </p>
      )}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {genres.slice(0, 3).map((genre) => (
            <span key={genre} className="rounded-md border border-border px-2 py-0.5 text-xs">
              {genre}
            </span>
          ))}
        </div>
      )}
      {listView && (developers.length > 0 || releaseYear || stats.length > 0) && (
        <div className="contents text-xs text-muted-foreground">
          {developers[0] && <span>{developers[0]}</span>}
          {releaseYear && <span>{developers[0] ? "·" : ""} {releaseYear}</span>}
          {stats.map((stat) => (
            <span key={stat}>· {stat}</span>
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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <LibraryInterestRating
              gameId={entry.game.id}
              gameName={entry.game.name}
              interest={entry.interest}
            />
            {entry.compatTag && <ProtonDbTag tag={entry.compatTag} />}
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
      <article className="flex min-h-44 overflow-hidden rounded-lg border border-border bg-primary/5 shadow-card">
        <div className="w-40 shrink-0 sm:w-48 lg:w-64 xl:w-80 min-[1600px]:w-96">
          <Cover entry={entry} variant="list" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 p-4 pb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h3 className="min-w-0 text-base font-bold leading-snug tracking-[-0.02em]">
                <Link href={`/games/${entry.game.id}`} className="hover:underline">
                  {entry.game.name}
                </Link>
              </h3>
              <LibraryInterestRating
                gameId={entry.game.id}
                gameName={entry.game.name}
                interest={entry.interest}
              />
              {entry.compatTag && <ProtonDbTag tag={entry.compatTag} />}
            </div>
            <div className="shrink-0">
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
