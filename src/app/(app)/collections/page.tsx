import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Clock, RotateCcw, Star, EyeOff, Flag, Folder } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSystemCollections } from "@/lib/system-collections";
import { CreateCollectionDialog } from "@/components/games/CreateCollectionDialog";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

const SYSTEM_ICONS: Record<string, LucideIcon> = {
  Clock,
  RotateCcw,
  Star,
  EyeOff,
  Flag,
};

export default async function CollectionsPage() {
  const [manualCollections, systemCollections] = await Promise.all([
    prisma.collection.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { members: true } },
      },
    }),
    getSystemCollections(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical-label text-muted-foreground">Library organization</p>
          <h1 className="mt-2">Collections</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Keep related games together, from calculated shelves to your own rotations.
          </p>
        </div>
        <CreateCollectionDialog />
      </div>

      <SectionCard
        eyebrow="System collections"
        title="Built-in shelves"
        id="system-collections-heading"
        description="Calculated from the current state of your library."
        status={<StatusPill>{systemCollections.length} shelves</StatusPill>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemCollections.map((c) => {
            const Icon = SYSTEM_ICONS[c.icon] ?? Folder;
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
        eyebrow="Personal collections"
        title="My collections"
        id="personal-collections-heading"
        description="Your custom groups stay editable and independent from calculated shelves."
        status={<StatusPill>{manualCollections.length} saved</StatusPill>}
      >
        {manualCollections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card-alt/30 py-10 text-center">
            <Folder className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-lg font-medium">No collections yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to start organizing your games.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {manualCollections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="group flex min-h-32 flex-col justify-between rounded-md border border-border bg-card-alt/40 p-4 transition-colors hover:border-primary/50 hover:bg-card-alt"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-background/70">
                    {c.color ? (
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                        aria-hidden
                      />
                    ) : (
                      <Folder className="size-4 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <StatusPill className="bg-background/70">
                    {c._count.members} {c._count.members === 1 ? "game" : "games"}
                  </StatusPill>
                </div>
                <span className="font-medium group-hover:text-primary">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
