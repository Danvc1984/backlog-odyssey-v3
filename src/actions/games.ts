"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { getOrCreateUnspecifiedSource } from "@/lib/sources/store";

const createGameSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  availabilitySource: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]),
  displayName: z.string().trim().optional(),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export async function createGame(input: CreateGameInput) {
  try {
    await requireUser();
    const parsed = createGameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, availabilitySource, displayName } = parsed.data;

    const game = await prisma.$transaction(async (tx) => {
      const alternativeSourceId =
        availabilitySource === "OTHER_PLATFORM"
          ? (await getOrCreateUnspecifiedSource(tx)).id
          : null;
      const created = await tx.game.create({
        data: {
          type: "BASE_GAME",
          origin: "MANUAL",
          name,
          availability: {
            create: {
              source: availabilitySource,
              displayName: displayName || null,
              alternativeSourceId,
            },
          },
          libraryEntry: {
            create: {},
          },
        },
        include: {
          availability: true,
          libraryEntry: true,
        },
      });
      return created;
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to create game",
    };
  }
}
