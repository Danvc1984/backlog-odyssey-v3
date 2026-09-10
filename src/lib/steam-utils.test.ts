import { describe, expect, it } from "vitest";

import { lastPlayedDate, stripTrademarkSymbols } from "./steam-utils";

describe("stripTrademarkSymbols", () => {
  it("leaves plain names untouched", () => {
    expect(stripTrademarkSymbols("Hades II")).toBe("Hades II");
  });

  it("removes a symbol at the end", () => {
    expect(stripTrademarkSymbols("Game Title™")).toBe("Game Title");
  });

  it("removes multiple symbols anywhere", () => {
    expect(stripTrademarkSymbols("Game® Title™")).toBe("Game Title");
  });

  it("removes a leading symbol and trailing whitespace", () => {
    expect(stripTrademarkSymbols("©Game Title  ")).toBe("Game Title");
  });

  it("removes copyright and registered symbols mid-name", () => {
    expect(stripTrademarkSymbols("Elden®Ring©")).toBe("EldenRing");
  });

  it("keeps a symbol-only name unchanged", () => {
    expect(stripTrademarkSymbols("™®©")).toBe("™®©");
  });
});

describe("lastPlayedDate", () => {
  it("returns null for never-played and negative timestamps", () => {
    expect(lastPlayedDate(0)).toBeNull();
    expect(lastPlayedDate(-5)).toBeNull();
  });

  it("converts positive Unix seconds to a date", () => {
    expect(lastPlayedDate(1700000000)).toEqual(new Date(1700000000 * 1000));
  });
});
