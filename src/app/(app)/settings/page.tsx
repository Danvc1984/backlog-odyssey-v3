import { prisma } from "@/lib/prisma";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";

export default async function SettingsPage() {
  const steamConnection = await prisma.steamConnection.findUnique({
    where: { id: 1 },
  });

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
    </div>
  );
}