"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

const collectionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().trim().optional().nullable(),
  icon: z.string().trim().optional().nullable(),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

export async function createCollection(input: CollectionInput) {
  try {
    await requireUser();
    const parsed = collectionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, color, icon } = parsed.data;

    const existing = await prisma.collection.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return {
        success: false as const,
        data: null,
        error: "A collection with that name already exists",
      };
    }

    const collection = await prisma.collection.create({
      data: { name, color: color ?? null, icon: icon ?? null },
    });

    return { success: true as const, data: collection, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to create collection",
    };
  }
}

export async function updateCollection(
  collectionId: string,
  input: CollectionInput,
) {
  try {
    await requireUser();
    if (typeof collectionId !== "string" || collectionId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const parsed = collectionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, color, icon } = parsed.data;

    const existing = await prisma.collection.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        id: { not: collectionId },
      },
    });
    if (existing) {
      return {
        success: false as const,
        data: null,
        error: "A collection with that name already exists",
      };
    }

    const collection = await prisma.collection.update({
      where: { id: collectionId },
      data: { name, color: color ?? null, icon: icon ?? null },
    });

    return { success: true as const, data: collection, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update collection",
    };
  }
}

export async function deleteCollection(collectionId: string) {
  try {
    await requireUser();
    if (typeof collectionId !== "string" || collectionId.trim() === "") {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    await prisma.collection.delete({ where: { id: collectionId } });

    return { success: true as const, data: null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to delete collection",
    };
  }
}

export async function addGameToCollection(
  collectionId: string,
  gameId: string,
) {
  try {
    await requireUser();
    if (
      typeof collectionId !== "string" ||
      collectionId.trim() === "" ||
      typeof gameId !== "string" ||
      gameId.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const membership = await prisma.collectionMembership
      .create({
        data: { collectionId, gameId },
      })
      .catch((e) => {
        if (e.code === "P2002") return null;
        throw e;
      });

    return { success: true as const, data: membership, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to add game to collection",
    };
  }
}

export async function removeGameFromCollection(
  collectionId: string,
  gameId: string,
) {
  try {
    await requireUser();
    if (
      typeof collectionId !== "string" ||
      collectionId.trim() === "" ||
      typeof gameId !== "string" ||
      gameId.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.collectionMembership.deleteMany({
      where: { collectionId, gameId },
    });

    return { success: true as const, data: { count: result.count }, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to remove game from collection",
    };
  }
}