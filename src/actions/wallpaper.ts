"use server";

import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { friendlyActionError } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import {
  dayStringInMexicoCity,
  parseWallpaperPool,
  pickShuffleIndex,
  resolveWallpaperSelection,
} from "@/lib/wallpaper";

const EMPTY_POOL_ERROR = "No wallpaper pool is available";

export async function shuffleWallpaper() {
  try {
    await requireUser();

    const [state, settings] = await Promise.all([
      prisma.wallpaperState.findUnique({ where: { id: 1 } }),
      prisma.appSettings.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
    ]);
    const pool = parseWallpaperPool(state?.candidates);
    if (!state || !pool || pool.items.length === 0) {
      return { success: false as const, data: null, error: EMPTY_POOL_ERROR };
    }

    const now = new Date();
    const currentSelection = resolveWallpaperSelection(state, now, settings?.timeZone);
    if (!currentSelection) {
      return { success: false as const, data: null, error: EMPTY_POOL_ERROR };
    }

    const selectedIdx = pickShuffleIndex(pool.items.length, currentSelection.index);
    if (selectedIdx === null) {
      return { success: false as const, data: null, error: EMPTY_POOL_ERROR };
    }

    const day = dayStringInMexicoCity(now, settings?.timeZone);
    await prisma.wallpaperState.update({
      where: { id: 1 },
      data: {
        selectedIdx,
        renderTarget: { day, source: "shuffle" } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true as const,
      data: {
        selection: {
          candidate: pool.items[selectedIdx],
          index: selectedIdx,
          source: "shuffle" as const,
        },
      },
      error: null,
    };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to shuffle wallpaper"),
    };
  }
}

export async function setWallpaperEnabled(enabled: boolean) {
  try {
    await requireUser();
    if (typeof enabled !== "boolean") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, wallpaperEnabled: enabled },
      update: { wallpaperEnabled: enabled },
    });

    return { success: true as const, data: settings, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to update wallpaper setting"),
    };
  }
}
