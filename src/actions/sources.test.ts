import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  createAlternativeSource,
  deleteAlternativeSource,
  renameAlternativeSource,
  setAlternativeSourceArchived,
} from "./sources";

const mockAltFind = vi.fn();
const mockAltCreate = vi.fn();
const mockAltUpdate = vi.fn();
const mockAltDelete = vi.fn();
const mockAvailabilityCount = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (prisma as unknown as { alternativeSource: unknown }).alternativeSource = {
    findUnique: mockAltFind,
    create: mockAltCreate,
    update: mockAltUpdate,
    delete: mockAltDelete,
  };
  (prisma as unknown as { gameAvailability: unknown }).gameAvailability = {
    count: mockAvailabilityCount,
  };
  mockAltFind.mockResolvedValue(null);
  mockAltCreate.mockResolvedValue({ id: "new-source" });
  mockAltUpdate.mockResolvedValue({ id: "src-1" });
  mockAltDelete.mockResolvedValue({ id: "src-1" });
  mockAvailabilityCount.mockResolvedValue(0);
});

describe("createAlternativeSource", () => {
  it("reuses the existing registry source when an alias is typed", async () => {
    mockAltFind.mockResolvedValue({
      id: "src-epic",
      name: "Epic Games Store",
      normalizedName: "epic games store",
      knownKey: "EPIC_GAMES_STORE",
    });

    const result = await createAlternativeSource({ name: "Epic" });

    expect(result).toEqual({
      success: true,
      data: {
        id: "src-epic",
        name: "Epic Games Store",
        normalizedName: "epic games store",
        knownKey: "EPIC_GAMES_STORE",
      },
      error: null,
    });
    expect(mockAltFind).toHaveBeenCalledWith({
      where: { knownKey: "EPIC_GAMES_STORE" },
    });
    expect(mockAltCreate).not.toHaveBeenCalled();
  });

  it("creates the registry source with its canonical name and key", async () => {
    mockAltFind.mockResolvedValue(null);
    mockAltCreate.mockResolvedValue({
      id: "src-epic",
      name: "Epic Games Store",
      normalizedName: "epic games store",
      knownKey: "EPIC_GAMES_STORE",
    });

    const result = await createAlternativeSource({ name: "EGS" });

    expect(result.success).toBe(true);
    expect(mockAltFind).toHaveBeenCalledWith({
      where: { knownKey: "EPIC_GAMES_STORE" },
    });
    expect(mockAltCreate).toHaveBeenCalledWith({
      data: {
        knownKey: "EPIC_GAMES_STORE",
        name: "Epic Games Store",
        normalizedName: "epic games store",
      },
    });
  });

  it("creates a custom source without a known key", async () => {
    const result = await createAlternativeSource({ name: "  My Store  " });

    expect(result.success).toBe(true);
    expect(mockAltFind).toHaveBeenCalledWith({
      where: { normalizedName: "my store" },
    });
    expect(mockAltCreate).toHaveBeenCalledWith({
      data: { name: "My Store", normalizedName: "my store" },
    });
  });

  it("rejects a custom name that collides on normalized name", async () => {
    mockAltFind.mockResolvedValue({ id: "existing" });

    const result = await createAlternativeSource({ name: "My Store" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "A source with that name already exists",
    });
    expect(mockAltCreate).not.toHaveBeenCalled();
  });

  it("rejects blank names and unknown fields", async () => {
    const blank = await createAlternativeSource({ name: "   " });
    const extra = await createAlternativeSource({
      name: "Store",
      knownKey: "HACK",
    });

    expect(blank.success).toBe(false);
    expect(blank.error).toBe("Invalid input");
    expect(extra.success).toBe(false);
    expect(mockAltCreate).not.toHaveBeenCalled();
  });
});

describe("renameAlternativeSource", () => {
  it("renames a source and never touches knownKey", async () => {
    mockAltFind.mockResolvedValueOnce({ id: "src-1" });

    const result = await renameAlternativeSource("src-1", {
      name: "  New Name  ",
    });

    expect(result.success).toBe(true);
    expect(mockAltFind).toHaveBeenCalledWith({
      where: { id: "src-1" },
      select: { id: true },
    });
    expect(mockAltUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { name: "New Name", normalizedName: "new name" },
    });
    expect(mockAltUpdate.mock.calls[0][0].data).not.toHaveProperty("knownKey");
  });

  it("renames a known source without losing its registry key", async () => {
    mockAltFind.mockResolvedValueOnce({ id: "src-epic" });

    const result = await renameAlternativeSource("src-epic", {
      name: "Epic launcher",
    });

    expect(result.success).toBe(true);
    expect(mockAltUpdate.mock.calls[0][0].data).not.toHaveProperty("knownKey");
  });

  it("rejects a name that another source already uses", async () => {
    mockAltFind.mockResolvedValueOnce({ id: "src-1" });
    mockAltFind.mockResolvedValueOnce({ id: "src-2" });

    const result = await renameAlternativeSource("src-1", { name: "GOG" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "A source with that name already exists",
    });
    expect(mockAltUpdate).not.toHaveBeenCalled();
  });

  it("allows keeping the current name", async () => {
    mockAltFind.mockResolvedValueOnce({ id: "src-1" });
    mockAltFind.mockResolvedValueOnce({ id: "src-1" });

    const result = await renameAlternativeSource("src-1", { name: "GOG" });

    expect(result.success).toBe(true);
    expect(mockAltUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { name: "GOG", normalizedName: "gog" },
    });
  });

  it("rejects a missing source", async () => {
    const result = await renameAlternativeSource("missing", { name: "GOG" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Source not found",
    });
    expect(mockAltUpdate).not.toHaveBeenCalled();
  });
});

describe("setAlternativeSourceArchived", () => {
  it("archives a source by setting archivedAt", async () => {
    mockAltFind.mockResolvedValue({ id: "src-1" });

    const result = await setAlternativeSourceArchived("src-1", {
      archived: true,
    });

    expect(result.success).toBe(true);
    expect(mockAltUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("is idempotent when already archived", async () => {
    mockAltFind.mockResolvedValue({ id: "src-1" });

    const first = await setAlternativeSourceArchived("src-1", { archived: true });
    const second = await setAlternativeSourceArchived("src-1", { archived: true });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(mockAltUpdate).toHaveBeenCalledTimes(2);
  });

  it("unarchives a source by clearing archivedAt", async () => {
    mockAltFind.mockResolvedValue({ id: "src-1" });

    const result = await setAlternativeSourceArchived("src-1", {
      archived: false,
    });

    expect(result.success).toBe(true);
    expect(mockAltUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: { archivedAt: null },
    });
  });

  it("rejects a missing source and invalid input", async () => {
    const missing = await setAlternativeSourceArchived("missing", {
      archived: true,
    });
    const invalid = await setAlternativeSourceArchived("src-1", {});

    expect(missing).toEqual({
      success: false,
      data: null,
      error: "Source not found",
    });
    expect(invalid.success).toBe(false);
    expect(mockAltUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteAlternativeSource", () => {
  it("removes an unused source", async () => {
    mockAltFind.mockResolvedValue({ id: "src-1" });
    const result = await deleteAlternativeSource("src-1");

    expect(result).toEqual({
      success: true,
      data: { id: "src-1" },
      error: null,
    });
    expect(mockAvailabilityCount).toHaveBeenCalledWith({
      where: { alternativeSourceId: "src-1" },
    });
    expect(mockAltDelete).toHaveBeenCalledWith({ where: { id: "src-1" } });
  });

  it("rejects a source that is in use", async () => {
    mockAltFind.mockResolvedValue({ id: "src-1" });
    mockAvailabilityCount.mockResolvedValue(1);

    const result = await deleteAlternativeSource("src-1");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Source is in use and cannot be removed",
    });
    expect(mockAltDelete).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid source", async () => {
    mockAltFind.mockResolvedValueOnce(null);
    const missing = await deleteAlternativeSource("missing");
    const invalid = await deleteAlternativeSource("   ");

    expect(missing.error).toBe("Source not found");
    expect(invalid.error).toBe("Invalid input");
    expect(mockAltDelete).not.toHaveBeenCalled();
  });
});
