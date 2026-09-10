import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { igdbTokenCache: { findUnique, upsert } },
}));

import {
  getIgdbAccessToken,
  getIgdbConfig,
  invalidateIgdbToken,
} from "./igdb-token";

describe("IGDB token manager", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("IGDB_CLIENT_ID", " client-id ");
    vi.stubEnv("IGDB_CLIENT_SECRET", " client-secret ");
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
  });

  it("requires both credentials without exposing their values", () => {
    vi.stubEnv("IGDB_CLIENT_SECRET", " ");

    expect(getIgdbConfig()).toEqual({
      ok: false,
      error: {
        category: "CONFIGURATION",
        message: "IGDB is not configured: set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET",
      },
    });
  });

  it("reuses a cached token outside the seven-day refresh window", async () => {
    findUnique.mockResolvedValue({
      accessToken: "cached-token",
      expiresAt: new Date("2026-09-18T12:00:01Z"),
    });

    await expect(getIgdbAccessToken()).resolves.toEqual({ ok: true, token: "cached-token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes proactively inside the seven-day window", async () => {
    findUnique.mockResolvedValue({
      accessToken: "old-token",
      expiresAt: new Date("2026-09-17T12:00:00Z"),
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600 }), { status: 200 }),
    );

    await expect(getIgdbAccessToken()).resolves.toEqual({ ok: true, token: "new-token" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      create: expect.objectContaining({ accessToken: "new-token" }),
    }));
  });

  it("shares one refresh among concurrent callers", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const first = getIgdbAccessToken();
    const second = getIgdbAccessToken();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({ access_token: "shared-token", expires_in: 3600 }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, token: "shared-token" },
      { ok: true, token: "shared-token" },
    ]);
  });

  it("keeps a still-valid token when refresh fails", async () => {
    findUnique.mockResolvedValue({
      accessToken: "old-token",
      expiresAt: new Date("2026-09-12T12:00:00Z"),
    });
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(getIgdbAccessToken()).resolves.toEqual({ ok: true, token: "old-token" });
  });

  it("classifies malformed token responses without leaking secrets", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "", expires_in: "3600" }), { status: 200 }),
    );

    const result = await getIgdbAccessToken();
    expect(result).toEqual({
      ok: false,
      error: {
        category: "CONFIGURATION",
        message: "Twitch returned an invalid IGDB access token response",
      },
    });
    expect(JSON.stringify(result)).not.toContain("client-secret");
  });

  it("forces a refresh after invalidation", async () => {
    findUnique.mockResolvedValue({
      accessToken: "cached-token",
      expiresAt: new Date("2026-09-20T12:00:00Z"),
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }), { status: 200 }),
    );
    invalidateIgdbToken();

    await expect(getIgdbAccessToken()).resolves.toEqual({ ok: true, token: "refreshed-token" });
  });
});
