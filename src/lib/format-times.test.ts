import { describe, expect, it } from "vitest";
import { formatMexicoTimestamp } from "./format-times";

describe("formatMexicoTimestamp", () => {
  it("formats a valid timestamp for Mexico City", () => {
    const formatted = formatMexicoTimestamp("2026-09-02T18:13:14.000Z");

    expect(formatted).toMatch(/0?2\/0?9\/2026/);
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it.each([null, "not-a-date"]) ("returns null for %s", (value) => {
    expect(formatMexicoTimestamp(value)).toBeNull();
  });

  it("returns stable output for the same timestamp", () => {
    const value = new Date("2026-09-02T18:13:14.000Z");

    expect(formatMexicoTimestamp(value)).toBe(formatMexicoTimestamp(value));
  });
});
