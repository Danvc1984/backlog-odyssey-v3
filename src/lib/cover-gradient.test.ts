import { describe, expect, it } from "vitest";
import { COVER_GRADIENTS, gradientFor } from "./cover-gradient";

describe("gradientFor", () => {
  it("maps the same id to the same gradient every time", () => {
    const id = "clx1234abcdef";
    expect(gradientFor(id)).toBe(gradientFor(id));
    expect(gradientFor(id)).toBe(gradientFor(id));
  });

  it("spreads different ids across the palette", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 64; index += 1) {
      seen.add(gradientFor(`game-${index}`));
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.size).toBeLessThanOrEqual(COVER_GRADIENTS.length);
  });

  it("returns only classes from the known token set", () => {
    for (let index = 0; index < 64; index += 1) {
      const gradient = gradientFor(`title-${index}`);
      expect(COVER_GRADIENTS).toContain(gradient);
      expect(gradient).toMatch(/^from-signal|^from-opportunity|^from-primary|^from-warning/);
    }
  });
});