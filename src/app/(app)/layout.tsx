import { after } from "next/server";

import { ActiveOperationsWatcher } from "@/components/games/ActiveOperationsWatcher";
import { WallpaperBackground } from "@/components/wallpaper/WallpaperBackground";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import {
  buildSearchPlan,
  isPoolStale,
  resolveWallpaperSelection,
  type WallpaperGameReference,
} from "@/lib/wallpaper";
import { refreshWallpaperPool } from "@/lib/wallpaper-refresh";
import { AppNav } from "./_components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const [settings, wallpaperState, catalogRows] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { wallpaperEnabled: true, timeZone: true },
    }),
    prisma.wallpaperState.findUnique({ where: { id: 1 } }),
    prisma.game.findMany({
      where: {
        type: "BASE_GAME",
        libraryEntry: {
          is: {
            hidden: false,
            OR: [{ isMainGame: true }, { playState: "IN_PROGRESS" }],
          },
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        libraryEntry: { select: { isMainGame: true, playState: true } },
      },
    }),
  ]);

  const mainGame = catalogRows.find((row) => row.libraryEntry?.isMainGame === true) ?? null;
  const inProgressGames = catalogRows
    .filter((row) => row.libraryEntry?.playState === "IN_PROGRESS")
    .map(({ id, name }): WallpaperGameReference => ({ id, name }));
  const searchPlan = buildSearchPlan(
    mainGame ? { id: mainGame.id, name: mainGame.name } : null,
    inProgressGames,
  );
  const wallpaperEnabled = settings?.wallpaperEnabled ?? true;
  const now = new Date();
  const shouldRefresh = wallpaperEnabled && isPoolStale(wallpaperState, searchPlan, now);
  if (shouldRefresh) {
    after(() => refreshWallpaperPool().catch(() => undefined));
  }
  const selection = wallpaperEnabled && wallpaperState
    ? resolveWallpaperSelection(wallpaperState, now, settings?.timeZone)
    : null;

  return (
    <div className="relative isolate flex min-h-screen">
      <WallpaperBackground enabled={wallpaperEnabled} selection={selection} />
      <ActiveOperationsWatcher />
      <div className="relative z-10 flex min-h-screen w-full">
        <AppNav
          email={session.user?.email}
          signOutAction={async () => {
            "use server";
            await signOut();
          }}
        />
        <main className="relative z-10 mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 pt-8 pb-24 md:px-[clamp(24px,5vw,72px)] md:pt-10 md:pb-12">
        {children}
        </main>
      </div>
    </div>
  );
}
