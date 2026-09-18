"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { friendlyActionError } from "@/lib/action-error";

const tagIdInputSchema = z.object({
  tagId: z.string().trim().min(1, "Tag is required"),
});

export async function deletePersonalTag(input: unknown) {
  try {
    await requireUser();
    const parsed = tagIdInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const tag = await prisma.personalTag.findUnique({
      where: { id: parsed.data.tagId },
      select: { id: true, name: true, _count: { select: { games: true } } },
    });
    if (!tag) {
      return { success: false as const, data: null, error: "Tag not found" };
    }

    await prisma.personalTag.delete({ where: { id: tag.id } });
    return {
      success: true as const,
      data: { id: tag.id, name: tag.name, removedGames: tag._count.games },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to delete tag"),
    };
  }
}
