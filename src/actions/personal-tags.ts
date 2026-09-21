"use server";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { friendlyActionError } from "@/lib/action-error";
import { normalizePersonalTagName, preparePersonalTagName } from "@/lib/personal-tag";
import { prisma } from "@/lib/prisma";
import { resetKnownGenreTagValuesCache } from "@/lib/recommendations/queries";

const tagNameSchema = z.string().trim().min(1, "Tag name is required");
const createTagSchema = z.object({ name: tagNameSchema }).strict();
const tagIdSchema = z.string().trim().min(1, "Tag is required");
const renameTagSchema = z.object({
  tagId: tagIdSchema,
  name: tagNameSchema,
  confirmMerge: z.boolean().optional().default(false),
}).strict();
const mergeTagSchema = z.object({
  tagId: tagIdSchema,
  targetTagId: tagIdSchema,
}).strict();
const deleteTagSchema = z.object({ tagId: tagIdSchema }).strict();

function invalidInput() {
  return { success: false as const, data: null, error: "Invalid input" };
}

function conflictError() {
  return "A tag with that name already exists; confirm merge to continue";
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function rewritePersonalTagReferences(
  value: unknown,
  absorbedNormalizedName: string,
  replacementName: string | null,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.personalTags)) return value;

  const nextNames: string[] = [];
  for (const entry of source.personalTags) {
    if (typeof entry !== "string") continue;
    if (normalizePersonalTagName(entry) === absorbedNormalizedName) {
      if (replacementName) nextNames.push(replacementName);
      continue;
    }
    nextNames.push(entry);
  }

  const seen = new Set<string>();
  const personalTags = nextNames.filter((name) => {
    const key = normalizePersonalTagName(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...source, personalTags };
}

async function repairActiveTagReferences(
  tx: Prisma.TransactionClient,
  absorbed: { normalizedName: string },
  replacementName: string | null,
) {
  const state = await tx.recommendationTuneState.findUnique({
    where: { id: 1 },
    select: { id: true, playTune: true, buyTune: true },
  });
  if (state) {
    await tx.recommendationTuneState.update({
      where: { id: state.id },
      data: {
        playTune: toNullableJson(rewritePersonalTagReferences(state.playTune, absorbed.normalizedName, replacementName)),
        buyTune: toNullableJson(rewritePersonalTagReferences(state.buyTune, absorbed.normalizedName, replacementName)),
      },
    });
  }

  const presets = await tx.recommendationPreset.findMany({ select: { id: true, tune: true } });
  for (const preset of presets) {
    await tx.recommendationPreset.update({
      where: { id: preset.id },
      data: {
        tune: rewritePersonalTagReferences(preset.tune, absorbed.normalizedName, replacementName) as Prisma.InputJsonValue,
      },
    });
  }
}

async function mergeTags(
  tx: Prisma.TransactionClient,
  absorbedId: string,
  survivorId: string,
) {
  const [absorbed, survivor] = await Promise.all([
    tx.personalTag.findUnique({ where: { id: absorbedId }, select: { id: true, name: true, normalizedName: true, _count: { select: { games: true } } } }),
    tx.personalTag.findUnique({ where: { id: survivorId }, select: { id: true, name: true, normalizedName: true } }),
  ]);
  if (!absorbed || !survivor) return null;

  const memberships = await tx.gameTag.findMany({
    where: { tagId: absorbed.id },
    select: { gameId: true },
  });
  if (memberships.length > 0) {
    await tx.gameTag.createMany({
      data: memberships.map(({ gameId }) => ({ gameId, tagId: survivor.id })),
      skipDuplicates: true,
    });
  }
  await repairActiveTagReferences(tx, absorbed, survivor.name);
  await tx.personalTag.delete({ where: { id: absorbed.id } });
  const survivorGames = await tx.gameTag.count({ where: { tagId: survivor.id } });

  return {
    id: survivor.id,
    name: survivor.name,
    count: survivorGames,
    mergedTagId: absorbed.id,
    mergedGames: absorbed._count.games,
  };
}

export async function listPersonalTags() {
  try {
    await requireUser();
    const tags = await prisma.personalTag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, normalizedName: true, _count: { select: { games: true } } },
    });
    return { success: true as const, data: tags, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to list tags") };
  }
}

export async function createPersonalTag(input: unknown) {
  try {
    await requireUser();
    const parsed = createTagSchema.safeParse(input);
    if (!parsed.success) return invalidInput();
    const { name, normalizedName } = preparePersonalTagName(parsed.data.name);
    const tag = await prisma.personalTag.upsert({
      where: { normalizedName },
      create: { name, normalizedName },
      update: {},
    });
    resetKnownGenreTagValuesCache();
    return { success: true as const, data: tag, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: isUniqueConflict(err) ? conflictError() : friendlyActionError(err, "Failed to create tag"),
    };
  }
}

export async function renamePersonalTag(input: unknown) {
  try {
    await requireUser();
    const parsed = renameTagSchema.safeParse(input);
    if (!parsed.success) return invalidInput();
    const { tagId, confirmMerge } = parsed.data;
    const { name, normalizedName } = preparePersonalTagName(parsed.data.name);

    const tag = await prisma.personalTag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true, normalizedName: true },
    });
    if (!tag) return { success: false as const, data: null, error: "Tag not found" };
    if (tag.normalizedName === normalizedName) {
      return { success: true as const, data: tag, error: null };
    }

    const target = await prisma.personalTag.findUnique({
      where: { normalizedName },
      select: { id: true },
    });
    if (target && target.id !== tag.id && !confirmMerge) {
      return { success: false as const, data: null, error: conflictError() };
    }

    const result = await prisma.$transaction(async (tx) => {
      if (target && target.id !== tag.id) {
        return mergeTags(tx, tag.id, target.id);
      }
      return tx.personalTag.update({
        where: { id: tag.id },
        data: { name, normalizedName },
      });
    });
    if (!result) return { success: false as const, data: null, error: "Tag not found" };
    resetKnownGenreTagValuesCache();
    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: isUniqueConflict(err) ? conflictError() : friendlyActionError(err, "Failed to rename tag"),
    };
  }
}

export async function mergePersonalTag(input: unknown) {
  try {
    await requireUser();
    const parsed = mergeTagSchema.safeParse(input);
    if (!parsed.success || parsed.data.tagId === parsed.data.targetTagId) return invalidInput();
    const result = await prisma.$transaction((tx) => mergeTags(tx, parsed.data.tagId, parsed.data.targetTagId));
    if (!result) return { success: false as const, data: null, error: "Tag not found" };
    resetKnownGenreTagValuesCache();
    return { success: true as const, data: result, error: null };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to merge tags") };
  }
}

export async function deletePersonalTag(input: unknown) {
  try {
    await requireUser();
    const parsed = deleteTagSchema.safeParse(input);
    if (!parsed.success) return invalidInput();

    const result = await prisma.$transaction(async (tx) => {
      const tag = await tx.personalTag.findUnique({
        where: { id: parsed.data.tagId },
        select: { id: true, name: true, normalizedName: true, _count: { select: { games: true } } },
      });
      if (!tag) return null;
      await repairActiveTagReferences(tx, tag, null);
      await tx.personalTag.delete({ where: { id: tag.id } });
      return { id: tag.id, name: tag.name, removedGames: tag._count.games };
    });
    if (!result) return { success: false as const, data: null, error: "Tag not found" };
    resetKnownGenreTagValuesCache();
    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to delete tag"),
    };
  }
}
