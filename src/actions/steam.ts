"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function disconnectSteam() {
  try {
    await requireUser();

    const existing = await prisma.steamConnection.findUnique({
      where: { id: 1 },
    });
    if (existing) {
      await prisma.steamConnection.delete({ where: { id: 1 } });
    }

    return { success: true as const, data: null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to disconnect Steam",
    };
  }
}