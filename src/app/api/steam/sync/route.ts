import { NextResponse } from "next/server";
import { syncSteamPlaytime } from "@/actions/steam-sync";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { steamDailySyncEnabled: true },
  });

  if (settings?.steamDailySyncEnabled === false) {
    return NextResponse.json({
      success: true,
      data: null,
      error: "Daily Steam sync is disabled",
    });
  }

  await requireUser();
  const result = await syncSteamPlaytime();
  return NextResponse.json(result);
}
