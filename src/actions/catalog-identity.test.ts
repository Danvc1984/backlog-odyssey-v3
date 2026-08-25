import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { setCatalogSteamAppId } from "./catalog-identity";

describe("setCatalogSteamAppId", () => {
  const findUniqueGame = vi.fn();
  const findUniqueIdentity = vi.fn();
  const createIdentity = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    Object.assign(prisma, {
      game: { findUnique: findUniqueGame },
      externalGameId: {
        findUnique: findUniqueIdentity,
        create: createIdentity,
      },
    });
    findUniqueGame.mockResolvedValue({ id: "game-1", externalIds: [] });
    findUniqueIdentity.mockResolvedValue(null);
    createIdentity.mockResolvedValue({ id: "identity-1", externalId: "620" });
  });

  it("persists a parsed Steam URL as an exact catalog identity", async () => {
    const result = await setCatalogSteamAppId({
      gameId: "game-1",
      identityInput: "https://store.steampowered.com/app/620/Portal_2/",
    });

    expect(result.success).toBe(true);
    expect(createIdentity).toHaveBeenCalledWith({
      data: {
        namespaceId: "620",
        namespace: "STEAM_APP",
        externalId: "620",
        matchMethod: "EXACT_STEAM_APP_ID",
        gameId: "game-1",
      },
    });
  });

  it("rejects an App ID already attached to another game", async () => {
    findUniqueIdentity.mockResolvedValue({ game: { name: "Portal 2" } });

    const result = await setCatalogSteamAppId({ gameId: "game-2", identityInput: "620" });

    expect(result).toMatchObject({ success: false, error: 'Steam App 620 is already attached to "Portal 2"' });
    expect(createIdentity).not.toHaveBeenCalled();
  });

  it("rejects invalid input before querying the catalog", async () => {
    const result = await setCatalogSteamAppId({ gameId: "game-1", identityInput: "Portal 2" });

    expect(result).toMatchObject({ success: false, error: expect.any(String) });
    expect(findUniqueGame).not.toHaveBeenCalled();
  });
});
