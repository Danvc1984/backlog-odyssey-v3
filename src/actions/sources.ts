"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  matchKnownSource,
  normalizeSourceName,
} from "@/lib/sources/known-sources";
import { findOrCreateSourceByKnownKey } from "@/lib/sources/store";

const sourceNameSchema = z.string().trim().min(1, "Name is required").max(120);

const createAlternativeSourceSchema = z
  .object({ name: sourceNameSchema })
  .strict();

const renameAlternativeSourceSchema = z
  .object({ name: sourceNameSchema })
  .strict();

const setAlternativeSourceArchivedSchema = z
  .object({ archived: z.boolean() })
  .strict();

export type CreateAlternativeSourceInput = z.infer<
  typeof createAlternativeSourceSchema
>;
export type RenameAlternativeSourceInput = z.infer<
  typeof renameAlternativeSourceSchema
>;
export type SetAlternativeSourceArchivedInput = z.infer<
  typeof setAlternativeSourceArchivedSchema
>;

const alternativeSourceIdSchema = z.string().trim().min(1);

function friendlyError(err: unknown, fallback: string) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return "A source with that name already exists";
  }
  return err instanceof Error ? err.message : fallback;
}

export async function createAlternativeSource(input: unknown) {
  try {
    await requireUser();
    const parsed = createAlternativeSourceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const name = parsed.data.name;
    const known = matchKnownSource(name);
    if (known) {
      const source = await findOrCreateSourceByKnownKey(prisma, known.key);
      return { success: true as const, data: source, error: null };
    }

    const normalizedName = normalizeSourceName(name);
    const existing = await prisma.alternativeSource.findUnique({
      where: { normalizedName },
    });
    if (existing) {
      return {
        success: false as const,
        data: null,
        error: "A source with that name already exists",
      };
    }

    const source = await prisma.alternativeSource.create({
      data: { name, normalizedName },
    });
    return { success: true as const, data: source, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyError(err, "Failed to create source"),
    };
  }
}

export async function renameAlternativeSource(id: string, input: unknown) {
  try {
    await requireUser();
    const parsed = renameAlternativeSourceSchema.safeParse(input);
    if (
      !parsed.success ||
      typeof id !== "string" ||
      id.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const existing = await prisma.alternativeSource.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false as const, data: null, error: "Source not found" };
    }

    const name = parsed.data.name;
    const normalizedName = normalizeSourceName(name);
    const collides = await prisma.alternativeSource.findUnique({
      where: { normalizedName },
      select: { id: true },
    });
    if (collides && collides.id !== id) {
      return {
        success: false as const,
        data: null,
        error: "A source with that name already exists",
      };
    }

    const source = await prisma.alternativeSource.update({
      where: { id },
      data: { name, normalizedName },
    });
    return { success: true as const, data: source, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyError(err, "Failed to rename source"),
    };
  }
}

export async function setAlternativeSourceArchived(
  id: string,
  input: unknown,
) {
  try {
    await requireUser();
    const parsed = setAlternativeSourceArchivedSchema.safeParse(input);
    if (
      !parsed.success ||
      typeof id !== "string" ||
      id.trim() === ""
    ) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const existing = await prisma.alternativeSource.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false as const, data: null, error: "Source not found" };
    }

    const source = await prisma.alternativeSource.update({
      where: { id },
      data: {
        archivedAt: parsed.data.archived ? new Date() : null,
      },
    });
    return { success: true as const, data: source, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error ? err.message : "Failed to update source archive state",
    };
  }
}

export async function deleteAlternativeSource(id: string) {
  try {
    await requireUser();
    const parsed = alternativeSourceIdSchema.safeParse(id);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const source = await prisma.alternativeSource.findUnique({
      where: { id: parsed.data },
      select: { id: true },
    });
    if (!source) {
      return { success: false as const, data: null, error: "Source not found" };
    }

    const availabilityCount = await prisma.gameAvailability.count({
      where: { alternativeSourceId: parsed.data },
    });
    if (availabilityCount > 0) {
      return {
        success: false as const,
        data: null,
        error: "Source is in use and cannot be removed",
      };
    }

    await prisma.alternativeSource.delete({ where: { id: parsed.data } });
    return { success: true as const, data: { id: parsed.data }, error: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        success: false as const,
        data: null,
        error: "Source is in use and cannot be removed",
      };
    }
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to remove source",
    };
  }
}
