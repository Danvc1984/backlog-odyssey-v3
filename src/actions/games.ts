"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { IGDB_JOB_MAX_ATTEMPTS } from "@/lib/igdb-job";
import { Prisma } from "@/generated/prisma/client";

const createGameSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    availabilitySource: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]),
    alternativeSourceId: z.string().trim().min(1).optional(),
    interest: z.number().int().min(1).max(5).optional(),
    selectedIgdbId: z.number().int().positive().optional(),
  })
  .strict();

export type CreateGameInput = z.infer<typeof createGameSchema>;

export async function createGame(input: CreateGameInput) {
  try {
    await requireUser();
    const parsed = createGameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const {
      name,
      availabilitySource,
      interest = 3,
      selectedIgdbId,
    } = parsed.data;

    if (availabilitySource === "OTHER_PLATFORM" && !parsed.data.alternativeSourceId) {
      return {
        success: false as const,
        data: null,
        error: "Alternative source is required",
      };
    }
    if (availabilitySource !== "OTHER_PLATFORM" && parsed.data.alternativeSourceId) {
      return {
        success: false as const,
        data: null,
        error: "Alternative source is only valid for other platforms",
      };
    }

    const game = await prisma.$transaction(async (tx) => {
      const alternativeSourceId = parsed.data.alternativeSourceId ?? null;
      if (alternativeSourceId) {
        const source = await tx.alternativeSource.findUnique({
          where: { id: alternativeSourceId },
          select: { id: true, archivedAt: true },
        });
        if (!source) throw new ActionError("Alternative source not found");
        if (source.archivedAt) throw new ActionError("This source is archived and cannot be selected");
      }
      const created = await tx.game.create({
        data: {
          type: "BASE_GAME",
          origin: "MANUAL",
          name,
          availability: {
            create: {
              source: availabilitySource,
              alternativeSourceId,
            },
          },
          libraryEntry: {
            create: { interest },
          },
        },
        include: {
          availability: true,
          libraryEntry: true,
        },
      });
      if (selectedIgdbId !== undefined) {
        await tx.enrichmentJob.create({
          data: {
            gameId: created.id,
            provider: "IGDB",
            status: "QUEUED",
            stage: "MATCHING",
            attempt: 0,
            maxAttempts: IGDB_JOB_MAX_ATTEMPTS,
            progress: 0,
            candidatePayload: Prisma.DbNull,
            selectedIgdbId,
          },
        });
      }
      return created;
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to create game"),
    };
  }
}
