import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { disconnectSteam } from "./steam";

describe("disconnectSteam", () => {
  const mockFindUnique = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      steamConnection: {
        findUnique: typeof mockFindUnique;
        delete: typeof mockDelete;
      };
    }).steamConnection = {
      findUnique: mockFindUnique,
      delete: mockDelete,
    };
  });

  it("deletes the connection when one exists", async () => {
    mockFindUnique.mockResolvedValue({ id: 1, steamId64: "76561198000000000" });

    const result = await disconnectSteam();

    expect(result.success).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("succeeds idempotently when no connection exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await disconnectSteam();

    expect(result.success).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("surfaces database errors", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB connection lost"));

    const result = await disconnectSteam();

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB connection lost");
  });
});
