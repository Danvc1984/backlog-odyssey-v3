import {
  RecommendationItemCard,
} from "@/components/recommendations/RecommendationItemCard";
import {
  UpdateRecommendationsButton,
} from "@/components/recommendations/UpdateRecommendationsButton";
import { prisma } from "@/lib/prisma";
import { RunExposureTracker } from "@/components/recommendations/RunExposureTracker";

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
    include: {
      items: {
        where: { wishlistEntryId: { not: null } },
        orderBy: { rank: "asc" },
        include: { wishlistEntry: { select: { name: true } } },
      },
    },
  });

  const items = latestPlayNextRun?.items ?? [];
  const buyItems = latestBuyRun?.items ?? [];

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
                  target={{ kind: "PLAY_NEXT", gameId: item.gameId }}
                  runId={latestPlayNextRun?.id}
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

      {latestPlayNextRun && (
        <RunExposureTracker
          runId={latestPlayNextRun.id}
          items={items.flatMap((item) => item.gameId ? [{ gameId: item.gameId }] : [])}
        />
      )}
      {latestBuyRun && (
        <RunExposureTracker
          runId={latestBuyRun.id}
          items={buyItems.flatMap((item) => item.wishlistEntryId ? [{ wishlistEntryId: item.wishlistEntryId }] : [])}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Buy
        </h2>
        {!latestBuyRun ? (
          <p className="text-sm text-muted-foreground">
            No buy recommendations yet. Update recommendations to score your wishlist.
          </p>
        ) : buyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible wishlist purchases right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {buyItems.map((item) => {
              if (!item.wishlistEntryId) return null;
              return (
                <RecommendationItemCard
                  key={item.id}
                  target={{ kind: "BUY", wishlistEntryId: item.wishlistEntryId }}
                  runId={latestBuyRun?.id}
                  name={item.wishlistEntry?.name ?? "Unknown game"}
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
    </div>
  );
}
