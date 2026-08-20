"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const createDlcSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    baseGameId: z.string().trim().min(1, "Base game is required"),
  })
  .strict();

export type CreateDlcInput = z.infer<typeof createDlcSchema>;

export async function createDlc(input: CreateDlcInput) {
  try {
    await requireUser();
    const parsed = createDlcSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, baseGameId } = parsed.data;
    const game = await prisma.$transaction(async (tx) => {
      const baseGame = await tx.game.findUnique({
        where: { id: baseGameId },
        select: { type: true },
      });

      if (!baseGame) {
        throw new Error("Base game not found");
      }
      if (baseGame.type !== "BASE_GAME") {
        throw new Error("DLC parent must be a base game");
      }

      return tx.game.create({
        data: {
          type: "DLC",
          origin: "MANUAL",
          name,
          baseGame: { connect: { id: baseGameId } },
        },
        include: { baseGame: true },
      });
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to create DLC",
    };
  }
}
