import { describe, expect, it } from "vitest";
import { parsePage, parsePageSize, resolveRange } from "./list-pagination";

describe("parsePageSize", () => {
  it("defaults to 18 when the parameter is absent or invalid", () => {
    expect(parsePageSize(null)).toBe(18);
    expect(parsePageSize(undefined)).toBe(18);
    expect(parsePageSize("7")).toBe(18);
    expect(parsePageSize("18.0")).toBe(18);
  });

  it("accepts the supported page sizes", () => {
    expect(parsePageSize("18")).toBe(18);
    expect(parsePageSize("48")).toBe(48);
    expect(parsePageSize("99")).toBe(99);
  });
});

describe("parsePage", () => {
  it("defaults malformed and below-one values to page one", () => {
    expect(parsePage(null, 4)).toBe(1);
    expect(parsePage("nope", 4)).toBe(1);
    expect(parsePage("-3", 4)).toBe(1);
    expect(parsePage("0", 4)).toBe(1);
  });

  it("clamps a valid page to the available range", () => {
    expect(parsePage("2", 4)).toBe(2);
    expect(parsePage("99", 4)).toBe(4);
    expect(parsePage("2", 0)).toBe(1);
  });
});

describe("resolveRange", () => {
  it("returns a one-based display range for a populated page", () => {
    expect(resolveRange(143, 2, 18)).toEqual({
      page: 2,
      size: 18,
      totalPages: 8,
      rangeStart: 19,
      rangeEnd: 36,
    });
  });

  it("clamps the page and final range end", () => {
    expect(resolveRange(43, 9, 18)).toEqual({
      page: 3,
      size: 18,
      totalPages: 3,
      rangeStart: 37,
      rangeEnd: 43,
    });
  });

  it("uses page one and a zero range for empty results", () => {
    expect(resolveRange(0, 4, 18)).toEqual({
      page: 1,
      size: 18,
      totalPages: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });
});
