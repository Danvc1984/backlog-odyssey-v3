import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WALLHAVEN_SEARCH_URL,
  normalizeWallhavenQuery,
  searchWallhaven,
} from "./wallhaven-api";

const response = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), { status: 200, ...init });

const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  path: `https://w.wallhaven.cc/full/${id}.jpg`,
  purity: "sfw",
  dimension_x: 1920,
  dimension_y: 1080,
  file_type: "image/jpeg",
  uploader: "wallpaper-user",
  ...overrides,
});

describe("searchWallhaven", () => {
  it("sends the required SFW random search parameters and maps candidates", async () => {
    const fetchFn = vi.fn().mockResolvedValue(response({ data: [entry("abc123")] }));

    const result = await searchWallhaven("Portal 2", fetchFn);

    expect(result).toEqual({
      ok: true,
      items: [
        {
          id: "abc123",
          pageUrl: "https://wallhaven.cc/w/abc123",
          imageUrl: "https://w.wallhaven.cc/full/abc123.jpg",
          width: 1920,
          height: 1080,
          fileType: "jpg",
          uploader: "wallpaper-user",
        },
      ],
    });
    const requestUrl = new URL(fetchFn.mock.calls[0]?.[0] as string);
    expect(requestUrl.origin + requestUrl.pathname).toBe(WALLHAVEN_SEARCH_URL);
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      q: "portal 2",
      categories: "111",
      purity: "100",
      sorting: "random",
      atleast: "1920x1080",
    });
  });

  it("normalizes title casing, trademark symbols, and whitespace for queries", () => {
    expect(normalizeWallhavenQuery("  Sekiro™:  Shadows Die Twice  "))
      .toBe("sekiro: shadows die twice");
    expect(normalizeWallhavenQuery("CARRION")).toBe("carrion");
  });

  it("filters non-SFW, unsupported, and malformed entries while keeping PNG metadata", async () => {
    const result = await searchWallhaven("Games", vi.fn().mockResolvedValue(response({
      data: [
        entry("jpeg"),
        entry("png", { file_type: "image/png", path: "https://w.wallhaven.cc/full/png.png", uploader: null }),
        entry("sketchy", { purity: "sketchy" }),
        entry("gif", { file_type: "image/gif" }),
        { id: "missing-fields" },
      ],
    })));

    expect(result).toMatchObject({
      ok: true,
      items: [
        { id: "jpeg", fileType: "jpg" },
        { id: "png", fileType: "png", uploader: null },
      ],
    });
  });

  it("honors the requested candidate cap", async () => {
    const result = await searchWallhaven(
      "Games",
      vi.fn().mockResolvedValue(response({ data: Array.from({ length: 12 }, (_, index) => entry(`game-${index}`)) })),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(10);
      expect(result.items.at(-1)?.id).toBe("game-9");
    }

    const expanded = await searchWallhaven(
      "Games",
      vi.fn().mockResolvedValue(response({ data: Array.from({ length: 12 }, (_, index) => entry(`game-${index}`)) })),
      20,
    );
    expect(expanded).toMatchObject({ ok: true, items: Array.from({ length: 12 }, (_, index) => ({ id: `game-${index}` })) });
  });

  it.each([
    ["429", new Response("busy", { status: 429 }), { category: "HTTP", status: 429 }],
    ["503", new Response("busy", { status: 503 }), { category: "HTTP", status: 503 }],
  ])("classifies an HTTP %s response", async (_label, failedResponse, expected) => {
    await expect(searchWallhaven("Games", vi.fn().mockResolvedValue(failedResponse)))
      .resolves.toMatchObject({ ok: false, error: expected });
  });

  it("classifies network failures", async () => {
    await expect(searchWallhaven("Games", vi.fn().mockRejectedValue(new Error("offline"))))
      .resolves.toMatchObject({ ok: false, error: { category: "NETWORK" } });
  });

  it.each([
    ["invalid JSON", new Response("not-json", { status: 200 })],
    ["invalid shape", response({ results: [] })],
  ])("classifies a malformed %s payload", async (_label, malformedResponse) => {
    await expect(searchWallhaven("Games", vi.fn().mockResolvedValue(malformedResponse)))
      .resolves.toMatchObject({ ok: false, error: { category: "MALFORMED_RESPONSE" } });
  });
});
