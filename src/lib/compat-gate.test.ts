import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import { getCompatibilityGate } from "./compat-gate";

const findUnique = vi.fn();

function settings(overrides: Record<string, unknown> = {}) {
  return {
    primaryOs: "LINUX",
    hasWindowsFallback: false,
    handheldOs: "NONE",
    onboardingCompleted: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(prisma, { appSettings: { findUnique } });
});

describe("getCompatibilityGate", () => {
  it("returns an inactive gate before settings exist", async () => {
    findUnique.mockResolvedValue(null);

    await expect(getCompatibilityGate()).resolves.toEqual({ setup: null, active: false });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it.each([
    ["Linux primary without fallback", settings(), true],
    ["Linux primary with fallback", settings({ hasWindowsFallback: true }), true],
    ["Windows primary with Linux handheld", settings({ primaryOs: "WINDOWS", handheldOs: "LINUX" }), true],
    ["Windows primary with Windows handheld", settings({ primaryOs: "WINDOWS", handheldOs: "WINDOWS" }), false],
  ])("derives the active flag for %s", async (_label, row, active) => {
    findUnique.mockResolvedValue(row);

    await expect(getCompatibilityGate()).resolves.toEqual({ setup: row, active });
  });
});
