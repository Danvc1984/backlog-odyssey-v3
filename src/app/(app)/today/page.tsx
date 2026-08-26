import Link from "next/link";
import {
  RecommendationItemCard,
} from "@/components/recommendations/RecommendationItemCard";
import {
  UpdateRecommendationsButton,
} from "@/components/recommendations/UpdateRecommendationsButton";
import { prisma } from "@/lib/prisma";

export default async function TodayPage() {
  const latestPlayNextRun = await prisma.recommendationRun.findFirst({
    where: { kind: "PLAY_NEXT" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { rank: "asc" },
        include: { game: { select: { name: true } } },
      },
    },
  });
  const latestBuyRun = await prisma.recommendationRun.findFirst({
    where: { kind: "BUY" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const items = latestPlayNextRun?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What to play next from your backlog.
          </p>
        </div>
        <UpdateRecommendationsButton />
      </div>

      {!latestPlayNextRun && (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recommendations yet. Update recommendations to build your play next list.
          </p>
          <div className="mt-4 flex justify-center">
            <UpdateRecommendationsButton />
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Play next
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible games right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              if (!item.gameId) return null;
              return (
                <RecommendationItemCard
                  key={item.id}
                  gameId={item.gameId}
                  name={item.game?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                />
              );
            })}
          </div>
        )}
      </section>

      {latestBuyRun && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Buy
          </h2>
          <p className="text-sm text-muted-foreground">No buy recommendations yet.</p>
          <Link href="/wishlist" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Prices live on the wishlist page
          </Link>
        </section>
      )}
    </div>
  );
}
