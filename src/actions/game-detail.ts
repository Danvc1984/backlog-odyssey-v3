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