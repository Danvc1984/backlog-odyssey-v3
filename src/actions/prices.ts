"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { getItadConfig } from "@/lib/itad-config";
import { runPriceRefresh } from "@/lib/price-refresh";

const noInputSchema = z.object({}).strict();

export interface PriceRefreshRunView {
  id: string;
  status: string;
  country: string | null;
  counts: unknown;
  requestedAt: Date;
  finishedAt: Date | null;
}

export async function updatePrices(input: unknown = {}) {
  try {
    await requireUser();
    const parsed = noInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const config = getItadConfig();
    if (!config.ok) {
      return { success: false as const, data: null, error: config.error };
    }

    const result = await runPriceRefresh(config.config.apiKey);
    if (!result.ok) {
      return {
        success: false as const,
        data: { runId: result.runId, reason: result.reason },
        error: "A price refresh is already running",
      };
    }

    const run = await prisma.priceRefresh.findUnique({
      where: { id: result.runId },
    });
    return { success: true as const, data: run ?? null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to refresh prices",
    };
  }
}

export async function getLatestPriceRefresh(input: unknown = {}) {
  try {
    await requireUser();
    const parsed = noInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const run = await prisma.priceRefresh.findFirst({
      orderBy: { requestedAt: "desc" },
    });
    return { success: true as const, data: run ?? null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to load price refresh status",
    };
  }
}
