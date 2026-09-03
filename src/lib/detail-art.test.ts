import { describe, expect, it } from "vitest";

import { resolveDetailArt } from "./detail-art";

describe("resolveDetailArt", () => {
  it("returns artwork when an image exists and reduced data is off", () => {
    expect(resolveDetailArt({ metadataImage: "https://art.example/cover.jpg", reducedData: false }))
      .toEqual({ kind: "artwork", imageUrl: "https://art.example/cover.jpg" });
  });

  it("returns gradient when no image exists and reduced data is off", () => {
    expect(resolveDetailArt({ metadataImage: null, reducedData: false }))
      .toEqual({ kind: "gradient", imageUrl: null });
  });

  it("returns token under reduced data even with artwork present", () => {
    expect(resolveDetailArt({ metadataImage: "https://art.example/cover.jpg", reducedData: true }))
      .toEqual({ kind: "token", imageUrl: null });
  });

  it("returns token under reduced data when no artwork exists", () => {
    expect(resolveDetailArt({ metadataImage: null, reducedData: true }))
      .toEqual({ kind: "token", imageUrl: null });
  });

  it("treats whitespace-only metadata as no artwork", () => {
    expect(resolveDetailArt({ metadataImage: "   ", reducedData: false }))
      .toEqual({ kind: "gradient", imageUrl: null });
  });

  it("is stable across repeated calls for the same inputs", () => {
    const input = { metadataImage: "https://art.example/cover.jpg", reducedData: false } as const;
    expect(resolveDetailArt(input)).toEqual(resolveDetailArt(input));
    expect(
      resolveDetailArt({ metadataImage: null, reducedData: true }),
    ).toEqual(resolveDetailArt({ metadataImage: null, reducedData: true }));
  });
});