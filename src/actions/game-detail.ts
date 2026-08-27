"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

const updatePersonalFieldsSchema = z.object({
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
  interest: z.number().int().min(1).max(5).optional().nullable(),
  rating: z.number().int().min(1).max(10).optional().nullable(),
  preferredEnvironment: z
    .enum(["BAZZITE", "STEAM_DECK", "WINDOWS"])
    .optional()
    .nullable(),
  gameExperience: z
    .enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdatePersonalFieldsInput = z.infer<
  typeof updatePersonalFieldsSchema
>;

export async function updatePersonalFields(
  gameId: string,
  input: UpdatePersonalFieldsInput,
) {
  try {
    await requireUser();
    const parsed = updatePersonalFieldsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const data = parsed.data;
    const entry = await prisma.libraryEntry.update({
      where: { gameId },
      data: {
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.interest !== undefined && { interest: data.interest }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.preferredEnvironment !== undefined && {
          preferredEnvironment: data.preferredEnvironment,
        }),
        ...(data.gameExperience !== undefined && { gameExperience: data.gameExperience }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return { success: true as const, data: entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update fields",
    };
  }
}

const updateGameNameSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
  })
  .strict();

export type UpdateGameNameInput = z.infer<typeof updateGameNameSchema>;

export async function updateGameName(
  gameId: string,
  input: UpdateGameNameInput,
) {
  try {
    await requireUser();
    const parsed = updateGameNameSchema.safeParse(input);
    if (!parsed.success || typeof gameId !== "string" || gameId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const game = await prisma.game.update({
      where: { id: gameId },
      data: { name: parsed.data.name },
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update game name",
    };
  }
}

const updateGameAvailabilitySchema = z
  .object({
    source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]).optional(),
    displayName: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export type UpdateGameAvailabilityInput = z.infer<
  typeof updateGameAvailabilitySchema
>;

export async function updateGameAvailability(
  availabilityId: string,
  input: UpdateGameAvailabilityInput,
) {
  try {
    await requireUser();
    const parsed = updateGameAvailabilitySchema.safeParse(input);
    if (
      !parsed.success ||
      typeof availabilityId !== "string" ||
      availabilityId.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const availability = await prisma.gameAvailability.findUnique({
      where: { id: availabilityId },
      select: { source: true },
    });
    if (!availability) {
      return { success: false as const, data: null, error: "Availability not found" };
    }
    const updated = await prisma.gameAvailability.update({
      where: { id: availabilityId },
      data: {
        ...(parsed.data.source !== undefined && { source: parsed.data.source }),
        ...(parsed.data.displayName !== undefined && {
          displayName: parsed.data.displayName,
        }),
      },
    });

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update availability",
    };
  }
}

const updatePlayStateSchema = z.object({
  playState: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "PLAYED_BEFORE", "ABANDONED"])
    .optional(),
  isMainGame: z.boolean().optional(),
  playSoon: z.boolean().optional(),
  replayCandidate: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export type UpdatePlayStateInput = z.infer<typeof updatePlayStateSchema>;

export async function updatePlayState(
  gameId: string,
  input: UpdatePlayStateInput,
) {
  try {
    await requireUser();
    const parsed = updatePlayStateSchema.safeParse(input);
    if (!parsed.success || typeof gameId !== "string" || gameId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const data = parsed.data;

    const updateData = {
      ...(data.playState !== undefined && { playState: data.playState }),
      ...(data.playSoon !== undefined && { playSoon: data.playSoon }),
      ...(data.replayCandidate !== undefined && {
        replayCandidate: data.replayCandidate,
      }),
      ...(data.hidden !== undefined && { hidden: data.hidden }),
      ...(data.isMainGame !== undefined && { isMainGame: data.isMainGame }),
    };

    if (data.isMainGame === true) {
      const entry = await prisma.$transaction(async (tx) => {
        await tx.libraryEntry.updateMany({
          where: { isMainGame: true, gameId: { not: gameId } },
          data: { isMainGame: false },
        });
        return tx.libraryEntry.update({
          where: { gameId },
          data: updateData,
        });
      });
      return { success: true as const, data: entry, error: null };
    }

    const entry = await prisma.libraryEntry.update({
      where: { gameId },
      data: updateData,
    });
    return { success: true as const, data: entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update play state",
    };
  }
}

const addTagToGameSchema = z.object({
  tagName: z.string().trim().min(1, "Tag name is required"),
});

export type AddTagToGameInput = z.infer<typeof addTagToGameSchema>;

export async function addTagToGame(gameId: string, input: AddTagToGameInput) {
  try {
    await requireUser();
    const parsed = addTagToGameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { tagName } = parsed.data;

    const tag = await prisma.personalTag.upsert({
      where: { name: tagName },
      create: { name: tagName },
      update: {},
    });

    await prisma.gameTag
      .create({
        data: { gameId, tagId: tag.id },
      })
      .catch((e) => {
        if (e.code === "P2002") return;
        throw e;
      });

    return { success: true as const, data: tag, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to add tag",
    };
  }
}
