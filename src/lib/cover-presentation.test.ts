import { describe, expect, it } from "vitest";
import { formatDescriptionPreview, formatFetchedAgo, resolveCoverPresentation } from "./cover-presentation";

describe("resolveCoverPresentation", () => {
  it("uses RAWG art when data is available", () => {
    expect(resolveCoverPresentation({ title: "Dark Souls", imageUrl: "https://img.test/ds.jpg", resolvedData: "off" })).toEqual({
      kind: "image",
      imageUrl: "https://img.test/ds.jpg",
    });
  });

  it("uses a deterministic gradient when data is reduced or art is missing", () => {
    expect(resolveCoverPresentation({ title: "Dark Souls", imageUrl: "https://img.test/ds.jpg", resolvedData: "on" })).toEqual({ kind: "gradient", imageUrl: null });
    expect(resolveCoverPresentation({ title: "Dark Souls", imageUrl: null, resolvedData: "off" })).toEqual({ kind: "gradient", imageUrl: null });
  });

  it("renders no presentation for an empty title", () => {
    expect(resolveCoverPresentation({ title: "  ", imageUrl: "https://img.test/ds.jpg", resolvedData: "off" })).toEqual({ kind: "none", imageUrl: null });
  });
});

describe("formatFetchedAgo", () => {
  const now = new Date("2026-08-26T18:00:00.000Z");

  it.each([
    ["2026-08-26T17:59:45.000Z", "Just now"],
    ["2026-08-26T17:30:00.000Z", "30 min ago"],
    ["2026-08-26T16:00:00.000Z", "2 hours ago"],
    ["2026-08-24T18:00:00.000Z", "2 days ago"],
  ])("formats %s", (value, expected) => {
    expect(formatFetchedAgo(value, now)).toBe(expected);
  });

  it("handles missing and invalid dates", () => {
    expect(formatFetchedAgo(null, now)).toBe("Not fetched");
    expect(formatFetchedAgo("not-a-date", now)).toBe("Not fetched");
  });
});

describe("formatDescriptionPreview", () => {
  it("normalizes whitespace and ends a long preview with three dots", () => {
    expect(formatDescriptionPreview("A   long description with more words", 20)).toBe("A long description...");
  });

  it("adds the preview suffix to short descriptions without changing their words", () => {
    expect(formatDescriptionPreview("A short description.", 100)).toBe("A short description...");
  });
});
