import { describe, expect, it } from "vitest";

import { lastPlayedDate } from "./steam-utils";

describe("lastPlayedDate", () => {
  it("returns null for never-played and negative timestamps", () => {
    expect(lastPlayedDate(0)).toBeNull();
    expect(lastPlayedDate(-5)).toBeNull();
  });

  it("converts positive Unix seconds to a date", () => {
    expect(lastPlayedDate(1700000000)).toEqual(new Date(1700000000 * 1000));
  });
});
