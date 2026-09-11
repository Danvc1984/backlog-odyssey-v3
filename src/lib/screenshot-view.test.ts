import { describe, expect, it } from "vitest";
import { resolveIgdbPageScreenshots, resolvePageScreenshots } from "@/lib/screenshot-view";

const screenshot = (overrides: Partial<{ rawgId: number; image: string; width: number | null; height: number | null }> = {}) => ({
  rawgId: 1,
  image: "https://media.rawg.io/screenshots/1.jpg",
  width: 1920,
  height: 1080,
  ...overrides,
});

describe("resolvePageScreenshots", () => {
  it("returns the capped list for a valid v3 row", () => {
    const row = { screenshots: Array.from({ length: 8 }, (_, index) => screenshot({ rawgId: index })) };
    expect(resolvePageScreenshots(row)).toHaveLength(6);
  });

  it("returns an empty list when the screenshots key is missing or not an array", () => {
    expect(resolvePageScreenshots({})).toEqual([]);
    expect(resolvePageScreenshots({ screenshots: "nope" })).toEqual([]);
    expect(resolvePageScreenshots({ screenshots: 42 })).toEqual([]);
  });

  it("returns an empty list for non-object payloads", () => {
    expect(resolvePageScreenshots(null)).toEqual([]);
    expect(resolvePageScreenshots(undefined)).toEqual([]);
    expect(resolvePageScreenshots("nope")).toEqual([]);
    expect(resolvePageScreenshots(42)).toEqual([]);
  });

  it("filters malformed entries and keeps valid ones", () => {
    const row = {
      screenshots: [
        screenshot(),
        { image: "https://example.com/x.jpg" },
        { rawgId: 2, image: "" },
        { rawgId: "bad", image: "https://example.com/bad.jpg" },
        { rawgId: 3, image: "https://example.com/3.jpg", width: "wide", height: null },
        screenshot({ rawgId: 4, width: null, height: 720 }),
      ],
    };
    expect(resolvePageScreenshots(row)).toEqual([
      screenshot(),
      screenshot({ rawgId: 4, width: null, height: 720 }),
    ]);
  });
});

describe("resolveIgdbPageScreenshots", () => {
  it("returns valid IGDB screenshots and caps the list", () => {
    const row = { screenshots: Array.from({ length: 8 }, (_, index) => ({
      image: `https://images.example/${index}.jpg`,
      width: 1920,
      height: 1080,
    })) };
    expect(resolveIgdbPageScreenshots(row)).toHaveLength(6);
  });

  it("filters malformed IGDB screenshot entries", () => {
    expect(resolveIgdbPageScreenshots({ screenshots: [
      { image: "https://images.example/valid.jpg", width: null, height: null },
      { image: "" },
      { image: "https://images.example/bad.jpg", width: "wide" },
    ] })).toEqual([{ image: "https://images.example/valid.jpg", width: null, height: null }]);
  });
});
