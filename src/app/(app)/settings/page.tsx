import { prisma } from "@/lib/prisma";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";

export default async function SettingsPage() {
  const [steamConnection, unresolvedDlcs, baseGames] = await Promise.all([
    prisma.steamConnection.findUnique({ where: { id: 1 } }),
    prisma.unresolvedSteamDlc.findMany({
      select: { id: true, steamAppId: true, name: true, steamBaseAppId: true, status: true },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Connected services
        </h2>
        <SteamConnectionCard
          connected={Boolean(steamConnection)}
          steamId64={steamConnection?.steamId64 ?? null}
        />
      </section>

      <UnresolvedDlcReviewCard items={unresolvedDlcs} baseGames={baseGames} />
    </div>
  );
}
