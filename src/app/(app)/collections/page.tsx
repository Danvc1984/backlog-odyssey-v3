import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowCounterClockwiseIcon,
  BooksIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeSlashIcon,
  FlagIcon,
  FolderIcon,
  GameControllerIcon,
  GitBranchIcon,
  ListIcon,
  PlayIcon,
  StackIcon,
  StarIcon,
  TagIcon,
} from "@phosphor-icons/react/ssr";
import { getPersonalTagCollections, getSystemCollections } from "@/lib/system-collections";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

const SYSTEM_ICONS: Record<string, Icon> = {
  Clock: ClockIcon,
  RotateCcw: ArrowCounterClockwiseIcon,
  Star: StarIcon,
  EyeOff: EyeSlashIcon,
  Flag: FlagIcon,
  Play: PlayIcon,
  CheckCircle: CheckCircleIcon,
  List: ListIcon,
  GameController: GameControllerIcon,
  Stack: StackIcon,
  Books: BooksIcon,
  GitBranch: GitBranchIcon,
};

export default async function CollectionsPage() {
  const [systemCollections, personalTagCollections] = await Promise.all([
    getSystemCollections(),
    getPersonalTagCollections(),
  ]);
  const builtInCollections = systemCollections.filter((collection) => !collection.kind);
  const dynamicCollections = systemCollections.filter((collection) => collection.kind);
  const tagCollections = personalTagCollections;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical-label text-muted-foreground">Library organization</p>
          <h1 className="mt-2">Collections</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Browse calculated shelves and personal tags without maintaining duplicate groups.
          </p>
        </div>
      </div>

      <SectionCard
        title="Built-in shelves"
        id="system-collections-heading"
        description="Calculated from the current state of your library."
        status={<StatusPill>{builtInCollections.length} shelves</StatusPill>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builtInCollections.map((c) => {
            const Icon = SYSTEM_ICONS[c.icon] ?? FolderIcon;
            return (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="group flex min-h-32 flex-col justify-between rounded-md border border-border bg-card-alt/40 p-4 transition-colors hover:border-primary/50 hover:bg-card-alt"
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="size-5" style={{ color: c.color }} aria-hidden />
                  <StatusPill className="bg-background/70">
                    {c.count} {c.count === 1 ? "game" : "games"}
                  </StatusPill>
                </div>
                <span className="font-medium group-hover:text-primary">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Series and franchises"
        id="dynamic-collections-heading"
        description="Derived from valid current IGDB metadata on games in your library."
        status={<StatusPill>{dynamicCollections.length} shelves</StatusPill>}
      >
        {dynamicCollections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card-alt/30 py-10 text-center">
            <BooksIcon className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-lg font-medium">No IGDB series or franchises yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Enrich library games with current IGDB metadata to see their calculated shelves here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dynamicCollections.map((c) => {
              const Icon = SYSTEM_ICONS[c.icon] ?? FolderIcon;
              return (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="group flex min-h-32 flex-col justify-between rounded-md border border-border bg-card-alt/40 p-4 transition-colors hover:border-primary/50 hover:bg-card-alt"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="size-5" style={{ color: c.color }} aria-hidden />
                    <StatusPill className="bg-background/70">
                      {c.count} {c.count === 1 ? "game" : "games"}
                    </StatusPill>
                  </div>
                  <div className="space-y-1">
                    <span className="technical-label text-muted-foreground">
                      IGDB {c.kind}
                    </span>
                    <span className="block font-medium group-hover:text-primary">{c.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Tag shelves"
        id="personal-tags-heading"
        description="Each personal tag automatically becomes a shelf, and a game can belong to more than one."
        status={<StatusPill>{tagCollections.length} shelves</StatusPill>}
      >
        {tagCollections.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card-alt/30 py-8 text-center text-sm text-muted-foreground">
            Add tags to games to create your first tag shelf.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tagCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.id}`}
                className="group flex min-h-32 flex-col justify-between rounded-md border border-border bg-card-alt/40 p-4 transition-colors hover:border-primary/50 hover:bg-card-alt"
              >
                <div className="flex items-start justify-between gap-3">
                  <TagIcon className="size-5" style={{ color: collection.color }} aria-hidden />
                  <StatusPill className="bg-background/70">
                    {collection.count} {collection.count === 1 ? "game" : "games"}
                  </StatusPill>
                </div>
                <span className="font-medium group-hover:text-primary">{collection.name}</span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  );
}
