"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { logRecommendationEvent, playStateTransitionKind } from "@/lib/recommendations/events";
import { derivePlayStateMutation } from "@/lib/play-state";
import { revalidatePath } from "next/cache";
import { preparePersonalTagName } from "@/lib/personal-tag";
import { resetKnownGenreTagValuesCache } from "@/lib/recommendations/queries";

const updatePersonalFieldsSchema = z.object({
  interest: z.number().int().min(1).max(5).optional().nullable(),
  rating: z.number().int().min(1).max(10).optional().nullable(),
  gameExperience: z
    .enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"])
    .optional()
    .nullable(),
  handheldSuitable: z.boolean().optional().nullable(),
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
        ...(data.interest !== undefined && { interest: data.interest }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.gameExperience !== undefined && { gameExperience: data.gameExperience }),
        ...(data.handheldSuitable !== undefined && { handheldSuitable: data.handheldSuitable }),
      },
    });

    return { success: true as const, data: entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to update fields"),
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
    revalidatePath(`/games/${gameId}`);

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to update game name"),
    };
  }
}

const updateGameAvailabilitySchema = z
  .object({
    source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]).optional(),
    alternativeSourceId: z.string().trim().min(1).optional(),
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

    const result = await prisma.$transaction(async (tx) => {
      const availability = await tx.gameAvailability.findUnique({
        where: { id: availabilityId },
        select: { id: true, gameId: true, source: true, alternativeSourceId: true },
      });
      if (!availability) {
        return { error: "Availability not found" };
      }

      const newSource = parsed.data.source ?? availability.source;
      if (
        newSource !== "OTHER_PLATFORM" &&
        parsed.data.alternativeSourceId !== undefined
      ) {
        return { error: "Alternative source is only valid for other platforms" };
      }

      const alternativeSourceId =
        newSource === "OTHER_PLATFORM"
          ? parsed.data.alternativeSourceId ??
            (availability.source === "OTHER_PLATFORM"
              ? availability.alternativeSourceId
              : null)
          : null;
      if (newSource === "OTHER_PLATFORM" && !alternativeSourceId) {
        return { error: "Alternative source is required" };
      }
      if (
        newSource === "OTHER_PLATFORM" &&
        parsed.data.alternativeSourceId !== undefined
      ) {
        const alternativeSource = await tx.alternativeSource.findUnique({
          where: { id: parsed.data.alternativeSourceId },
          select: { id: true, archivedAt: true },
        });
        if (!alternativeSource) return { error: "Alternative source not found" };
        if (alternativeSource.archivedAt) {
          return { error: "This source is archived and cannot be selected" };
        }
      }

      if (newSource !== availability.source || alternativeSourceId !== availability.alternativeSourceId) {
        const rows = await tx.gameAvailability.findMany({
          where: { gameId: availability.gameId },
          select: { id: true, source: true, alternativeSourceId: true },
        });
        const siblings = rows.filter((row) => row.id !== availabilityId);
        if (newSource !== "OTHER_PLATFORM") {
          if (siblings.some((row) => row.source === newSource)) {
            return {
              error:
                newSource === "STEAM"
                  ? "This game already has a Steam source"
                  : "This game already has a ROM source",
            };
          }
        } else if (
          siblings.some(
            (row) =>
              row.source === "OTHER_PLATFORM" &&
              row.alternativeSourceId === alternativeSourceId,
          )
        ) {
          return { error: "This game already has that store source" };
        }
      }

      const updated = await tx.gameAvailability.update({
        where: { id: availabilityId },
        data: {
          ...(parsed.data.source !== undefined && { source: parsed.data.source }),
          alternativeSourceId,
        },
      });
      return { updated };
    });

    if ("error" in result) {
      return { success: false as const, data: null, error: result.error };
    }
    return { success: true as const, data: result.updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        friendlyActionError(err, "Failed to update availability"),
    };
  }
}

const addGameAvailabilitySchema = z
  .discriminatedUnion("source", [
    z.object({ source: z.literal("STEAM") }).strict(),
    z.object({ source: z.literal("ROM") }).strict(),
    z
      .object({
        source: z.literal("OTHER_PLATFORM"),
        alternativeSourceId: z.string().trim().min(1),
      })
      .strict(),
  ]);

export type AddGameAvailabilityInput = z.infer<
  typeof addGameAvailabilitySchema
>;

function availabilityConflictError(err: unknown): string | null {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return "This game already has that availability source";
  }
  return null;
}

export async function addGameAvailability(
  gameId: string,
  input: AddGameAvailabilityInput,
) {
  try {
    await requireUser();
    const parsed = addGameAvailabilitySchema.safeParse(input);
    if (!parsed.success || typeof gameId !== "string" || gameId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });
    if (!game) {
      return { success: false as const, data: null, error: "Game not found" };
    }

    const { source } = parsed.data;
    const alternativeSourceId =
      source === "OTHER_PLATFORM" ? parsed.data.alternativeSourceId : null;
    const duplicate = await prisma.gameAvailability.findFirst({
      where:
        source === "OTHER_PLATFORM"
          ? { gameId, source, alternativeSourceId }
          : { gameId, source },
    });
    if (duplicate) {
      return {
        success: false as const,
        data: null,
        error:
          source === "STEAM"
            ? "This game already has a Steam source"
            : source === "ROM"
              ? "This game already has a ROM source"
              : "This game already has that store source",
      };
    }

    if (source === "OTHER_PLATFORM") {
      const alternativeSource = await prisma.alternativeSource.findUnique({
        where: { id: parsed.data.alternativeSourceId },
        select: { id: true, archivedAt: true },
      });
      if (!alternativeSource) {
        return {
          success: false as const,
          data: null,
          error: "Alternative source not found",
        };
      }
      if (alternativeSource.archivedAt) {
        return {
          success: false as const,
          data: null,
          error: "This source is archived and cannot be selected",
        };
      }
    }

    const availability = await prisma.gameAvailability.create({
      data: { gameId, source, alternativeSourceId },
    });
    return { success: true as const, data: availability, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        availabilityConflictError(err) ??
        (friendlyActionError(err, "Failed to add availability")),
    };
  }
}

export async function removeGameAvailability(availabilityId: string) {
  try {
    await requireUser();
    if (
      typeof availabilityId !== "string" ||
      availabilityId.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const availability = await prisma.gameAvailability.findUnique({
      where: { id: availabilityId },
      select: {
        id: true,
        source: true,
        steamAppId: true,
        steamPlaytimeTotal: true,
        steamLastPlayed: true,
      },
    });
    if (!availability) {
      return {
        success: false as const,
        data: null,
        error: "Availability not found",
      };
    }
    if (
      availability.source === "STEAM" &&
      (availability.steamAppId !== null ||
        availability.steamPlaytimeTotal !== null ||
        availability.steamLastPlayed !== null)
    ) {
      return {
        success: false as const,
        data: null,
        error: "Steam statistics are synchronized",
      };
    }

    await prisma.gameAvailability.delete({ where: { id: availabilityId } });
    return {
      success: true as const,
      data: { id: availabilityId },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        friendlyActionError(err, "Failed to remove availability"),
    };
  }
}

const updatePlayStateSchema = z.object({
  playState: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"])
    .optional(),
  isMainGame: z.boolean().optional(),
  playSoon: z.boolean().optional(),
  replayCandidate: z.boolean().optional(),
  hidden: z.boolean().optional(),
  completedBefore: z.boolean().optional(),
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
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.libraryEntry.findUnique({
        where: { gameId },
        select: { playState: true, completedBefore: true, isMainGame: true },
      });
      if (!current) {
        throw new ActionError("Library entry not found");
      }

      const updateData = derivePlayStateMutation(current, data);
      const shouldClearWallpaper =
        (data.isMainGame === true && !current.isMainGame) ||
        (data.isMainGame === false && current.isMainGame);

      if (data.isMainGame === true) {
        await tx.libraryEntry.updateMany({
          where: { isMainGame: true, gameId: { not: gameId } },
          data: { isMainGame: false },
        });
      }

      const entry = await tx.libraryEntry.update({
        where: { gameId },
        data: updateData,
      });
      if (shouldClearWallpaper) {
        await clearWallpaperPool(tx);
      }
      return { current, entry };
    });
    await logPlayStateEvent(result.current.playState, data.playState, gameId);
    return { success: true as const, data: result.entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to update play state"),
    };
  }
}

async function clearWallpaperPool(
  tx: Pick<typeof prisma, "wallpaperState">,
): Promise<void> {
  await tx.wallpaperState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      candidates: Prisma.JsonNull,
      selectedIdx: 0,
      renderTarget: Prisma.JsonNull,
      lastAttemptAt: null,
      lastError: null,
    },
    update: {
      candidates: Prisma.JsonNull,
      selectedIdx: 0,
      renderTarget: Prisma.JsonNull,
      lastAttemptAt: null,
      lastError: null,
    },
  });
}

async function logPlayStateEvent(
  previous: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED",
  next: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | undefined,
  gameId: string,
) {
  if (next === undefined) return;
  const kind = playStateTransitionKind(previous, next);
  if (!kind) return;
  try {
    await logRecommendationEvent(prisma, { kind, gameId });
  } catch {
    // Event telemetry must not make a successful play-state update fail.
  }
}

const addTagToGameSchema = z.object({
  tagName: z.string().trim().min(1, "Tag name is required"),
});

export type AddTagToGameInput = z.infer<typeof addTagToGameSchema>;

const tagIdSchema = z.string().trim().min(1, "Tag is required");

export async function addTagToGame(gameId: string, input: AddTagToGameInput) {
  try {
    await requireUser();
    const parsed = addTagToGameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, normalizedName } = preparePersonalTagName(parsed.data.tagName);

    const tag = await prisma.personalTag.upsert({
      where: { normalizedName },
      create: { name, normalizedName },
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

    resetKnownGenreTagValuesCache();
    return { success: true as const, data: tag, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to add tag"),
    };
  }
}

export async function removeTagFromGame(gameId: string, tagId: string) {
  try {
    await requireUser();
    const parsedGameId = z.string().trim().min(1).safeParse(gameId);
    const parsedTagId = tagIdSchema.safeParse(tagId);
    if (!parsedGameId.success || !parsedTagId.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    await prisma.gameTag.deleteMany({
      where: { gameId: parsedGameId.data, tagId: parsedTagId.data },
    });
    return {
      success: true as const,
      data: { gameId: parsedGameId.data, tagId: parsedTagId.data },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to remove tag"),
    };
  }
}
