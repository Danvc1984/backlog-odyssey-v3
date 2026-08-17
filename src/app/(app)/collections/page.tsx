import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Clock, RotateCcw, Star, EyeOff, Flag, Folder } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSystemCollections } from "@/lib/system-collections";
import { CreateCollectionDialog } from "@/components/games/CreateCollectionDialog";

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
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <CreateCollectionDialog />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          System collections
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systemCollections.map((c) => {
            const Icon = SYSTEM_ICONS[c.icon] ?? Folder;
            return (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Icon
                    className="size-4"
                    style={{ color: c.color }}
                    aria-hidden
                  />
                  {c.name}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.count} {c.count === 1 ? "game" : "games"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          My collections
        </h2>
        <div className="mt-3">
          {manualCollections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
              <Folder className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-lg font-medium">No collections yet</p>
              <p className="text-sm text-muted-foreground">
                Create one to start organizing your games.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {manualCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-2">
                      {c.color ? (
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                      ) : (
                        <Folder
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                      {c.name}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c._count.members} {c._count.members === 1 ? "game" : "games"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}