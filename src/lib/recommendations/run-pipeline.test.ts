import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Prisma } from "@/generated/prisma/client";
import { persistRecommendationRuns } from "./run-pipeline";
import type { CompatEvidenceInput } from "./types";

const evidence: CompatEvidenceInput = {
  hasSteamIdentity: true,
  romOnly: false,
  overrideStatus: null,
  overrideReason: null,
  protonDbStatus: "REQUIRED",
  protonDbFetchedAt: new Date("2026-09-01T00:00:00.000Z"),
  awayStatus: "Supported",
};

const buyItem = {
  id: "wish-1",
  score: 10,
  positive: [],
  negative: [],
  caveats: [],
  role: "DEAL" as const,
};

function client() {
  return {
    recommendationRun: {
      create: vi.fn()
        .mockResolvedValueOnce({ id: "play-run" })
        .mockResolvedValueOnce({ id: "buy-run" }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("persistRecommendationRuns buy compatibility caveats", () => {
  it("persists the compatibility caveat on a Linux setup without fallback", async () => {
    const tx = client();

    await persistRecommendationRuns(
      tx,
      {},
      {},
      [],
      [buyItem],
      new Map(),
      new Map([["wish-1", evidence]]),
      new Date("2026-09-07T00:00:00.000Z"),
      { primaryOs: "LINUX", hasWindowsFallback: false, handheldOs: "NONE", onboardingCompleted: true },
    );

    const buyCreate = vi.mocked(tx.recommendationRun.create).mock.calls[1]?.[0] as {
      data: { items: { create: Array<{ caveats: unknown }> } };
    };
    expect(buyCreate.data.items.create[0]?.caveats).toEqual([
      { factor: "compat_required", label: "Requires Windows to run" },
    ]);
  });

  it("omits compatibility caveats on an all-Windows setup", async () => {
    const tx = client();

    await persistRecommendationRuns(
      tx,
      {},
      {},
      [],
      [buyItem],
      new Map(),
      new Map([["wish-1", evidence]]),
      new Date("2026-09-07T00:00:00.000Z"),
      { primaryOs: "WINDOWS", hasWindowsFallback: false, handheldOs: "NONE", onboardingCompleted: true },
    );

    const buyCreate = vi.mocked(tx.recommendationRun.create).mock.calls[1]?.[0] as {
      data: { items: { create: Array<{ caveats: unknown }> } };
    };
    expect(buyCreate.data.items.create[0]?.caveats).toEqual([]);
  });
});
