import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./palette", () => ({ extractPaletteFromImageBytes: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { extractPaletteFromImageBytes } from "./palette";
import {
  persistIgdbIdentity,
  persistIgdbSnapshot,
  selectIgdbPaletteSources,
} from "./igdb-enrichment";
import type { IgdbGameResponse, IgdbMatchResult } from "./igdb-types";

const findUnique = vi.fn();
const deleteMany = vi.fn();
const create = vi.fn();
const transaction = vi.fn();
const deleteSnapshots = vi.fn();
const createSnapshot = vi.fn();
const tx = {
  externalGameId: { findUnique, deleteMany, create },
  metadataSnapshot: { deleteMany: deleteSnapshots, create: createSnapshot },
};

const matched: IgdbMatchResult = {
  outcome: "MATCHED",
  matchMethod: "INFERRED",
  game: { id: 42, name: "Portal 2", category: 0 },
};

const metadataGame: IgdbGameResponse = {
  id: 42,
  slug: "portal-2",
  name: "Portal 2",
  summary: "A puzzle game",
  cover: { image_id: "cover" },
  artworks: [{ image_id: "artwork", image_type: { name: "Artwork" } }],
  screenshots: [{ image_id: "screenshot", width: 1920, height: 1080 }],
};

describe("IGDB identity persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    findUnique.mockResolvedValue(null);
    deleteMany.mockResolvedValue({ count: 0 });
    create.mockResolvedValue({ id: "identity-1" });
    deleteSnapshots.mockResolvedValue({ count: 1 });
    createSnapshot.mockResolvedValue({ id: "snapshot-1" });
    vi.mocked(extractPaletteFromImageBytes).mockResolvedValue(null);
  });

  it("selects artwork, first screenshot, and cover in fallback order", () => {
    expect(selectIgdbPaletteSources({
      artworkUrls: ["artwork-url", "second-artwork"],
      screenshots: [{ image: "screenshot-url", width: null, height: null }],
      coverUrl: "cover-url",
    })).toEqual(["artwork-url", "screenshot-url", "cover-url"]);
  });

  it("replaces the IGDB snapshot and maps attribution and captured palette", async () => {
    const fetchImage = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    });
    const palette = { primary: "#111111", dark: "#222222", muted: "#333333" };
    vi.mocked(extractPaletteFromImageBytes).mockResolvedValue(palette);
    const fetchedAt = new Date("2026-09-10T19:00:00.000Z");

    await expect(persistIgdbSnapshot("game-1", metadataGame, fetchedAt, { fetchImage }))
      .resolves.toEqual({ success: true, data: { gameId: "game-1", fetchedAt }, error: null });

    expect(fetchImage).toHaveBeenCalledWith(
      "https://images.igdb.com/igdb/image/upload/t_720p/artwork.jpg",
      expect.any(Object),
    );
    expect(deleteSnapshots).toHaveBeenCalledWith({ where: { gameId: "game-1", provider: "IGDB" } });
    expect(deleteSnapshots.mock.invocationCallOrder[0]).toBeLessThan(createSnapshot.mock.invocationCallOrder[0]);
    expect(createSnapshot).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gameId: "game-1",
        provider: "IGDB",
        sourceUrl: "https://www.igdb.com/games/portal-2",
        fetchedAt,
        payload: expect.objectContaining({ name: "Portal 2", palette }),
      }),
    });
  });

  it("falls through failed image sources and persists a null palette when none succeed", async () => {
    const fetchImage = vi.fn()
      .mockRejectedValueOnce(new Error("artwork unavailable"))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) })
      .mockResolvedValueOnce({ ok: false, arrayBuffer: async () => new ArrayBuffer(2) });
    vi.mocked(extractPaletteFromImageBytes).mockRejectedValueOnce(new Error("invalid image"));

    await expect(persistIgdbSnapshot("game-1", metadataGame, new Date(), { fetchImage }))
      .resolves.toMatchObject({ success: true });

    expect(fetchImage).toHaveBeenNthCalledWith(1, expect.stringContaining("artwork"), expect.any(Object));
    expect(fetchImage).toHaveBeenNthCalledWith(2, expect.stringContaining("screenshot"), expect.any(Object));
    expect(fetchImage).toHaveBeenNthCalledWith(3, expect.stringContaining("cover"), expect.any(Object));
    expect(deleteSnapshots).toHaveBeenCalledTimes(1);
    expect(createSnapshot).toHaveBeenCalledWith({
      data: expect.objectContaining({ payload: expect.objectContaining({ palette: null }) }),
    });
  });

  it("returns a conflict without mutating either game", async () => {
    findUnique.mockResolvedValue({ gameId: "other-game", matchMethod: "INFERRED" });

    await expect(persistIgdbIdentity("game-1", matched)).resolves.toEqual({
      success: false,
      data: null,
      error: { code: "IGDB_ID_CONFLICT", message: "IGDB game identity is already attached to another catalog game" },
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("replaces only the existing IGDB identity rows", async () => {
    await expect(persistIgdbIdentity("game-1", matched)).resolves.toEqual({
      success: true,
      data: { gameId: "game-1", igdbId: 42 },
      error: null,
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { gameId: "game-1", namespace: "IGDB_GAME" } });
    expect(create).toHaveBeenCalledWith({
      data: {
        namespaceId: "42",
        namespace: "IGDB_GAME",
        externalId: "42",
        matchMethod: "INFERRED",
        gameId: "game-1",
      },
    });
  });

  it("preserves a manual match against automatic rematching", async () => {
    findUnique.mockResolvedValue({ gameId: "game-1", matchMethod: "MANUAL_IGDB_SEARCH" });

    await expect(persistIgdbIdentity("game-1", matched)).resolves.toMatchObject({ success: true });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("allows an explicit manual replacement", async () => {
    findUnique.mockResolvedValue({ gameId: "game-1", matchMethod: "MANUAL_IGDB_SEARCH" });
    const manual: IgdbMatchResult = {
      ...matched,
      matchMethod: "MANUAL_IGDB_SEARCH",
      game: { id: 99, name: "Different game", category: 0 },
    };

    await expect(persistIgdbIdentity("game-1", manual)).resolves.toMatchObject({
      success: true,
      data: { igdbId: 99 },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ externalId: "99" }) }));
  });

  it("rejects non-matched outcomes", async () => {
    await expect(persistIgdbIdentity("game-1", { outcome: "NOT_FOUND" })).resolves.toMatchObject({
      success: false,
      error: { code: "NOT_MATCHED" },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
