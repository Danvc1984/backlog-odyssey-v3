import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy-match";

describe("fuzzyMatch", () => {
  it("matches exact substring at top score", () => {
    const result = fuzzyMatch("dark", "Dark Souls III");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0.9);
  });

  it("matches a typo with a doubled letter", () => {
    expect(fuzzyMatch("carion", "Carrion").matched).toBe(true);
    expect(fuzzyMatch("carrion", "Carrion").matched).toBe(true);
  });

  it("matches transposed characters", () => {
    expect(fuzzyMatch("recieve", "Receive").matched).toBe(true);
    expect(fuzzyMatch("forehand", "Forehand").matched).toBe(true);
  });

  it("matches multi-word queries through token containment", () => {
    const result = fuzzyMatch("dark souls", "Dark Souls Remastered");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("matches a typo in one token of a multi-word query", () => {
    expect(fuzzyMatch("daek souls", "Dark Souls III").matched).toBe(true);
  });

  it("rejects unrelated names", () => {
    expect(fuzzyMatch("portal", "Celeste").matched).toBe(false);
    expect(fuzzyMatch("minecraft", "Hades").matched).toBe(false);
  });

  it("does not flood on short queries", () => {
    expect(fuzzyMatch("cd", "Cataclysm").matched).toBe(false);
    expect(fuzzyMatch("aa", "Hearthstone").matched).toBe(false);
  });

  it("applies substring search against a one-word name", () => {
    const result = fuzzyMatch("carrion", "SCARRION");
    expect(result.matched).toBe(true);
  });

  it("normalizes diacritics and punctuation", () => {
    expect(fuzzyMatch("cafe", "Cafe").matched).toBe(true);
    expect(fuzzyMatch("cafè", "Cafe").matched).toBe(true);
    expect(fuzzyMatch("bioshock", "BioShock (2007)").matched).toBe(true);
  });

  it("treats empty or whitespace queries as no match", () => {
    expect(fuzzyMatch("", "Portal").matched).toBe(false);
    expect(fuzzyMatch("   ", "Portal").matched).toBe(false);
  });

  it("returns higher score for exact than approximate", () => {
    const exact = fuzzyMatch("carrion", "Carrion");
    const approximate = fuzzyMatch("carion", "Carrion");
    expect(exact.score).toBeGreaterThan(approximate.score);
  });
});