import { describe, expect, it } from "vitest";
import { filterStaleExposures } from "./exposure";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-27T00:00:00.000Z");

function candidates(...ids: string[]) {
  return ids.map((id) => ({ id }));
}

describe("filterStaleExposures", () => {
  it("treats an exposure at the seven-day boundary as stale", () => {
    const result = filterStaleExposures(
      candidates("boundary", "older"),
      new Map([
        ["boundary", new Date(now.getTime() - 7 * DAY)],
        ["older", new Date(now.getTime() - (7 * DAY + 1))],
      ]),
      now,
      1,
    );

    expect(result).toEqual({ candidates: [{ id: "older" }], staleExcluded: 1 });
  });

  it("excludes recent exposures when the non-stale pool fills the display count", () => {
    const result = filterStaleExposures(
      candidates("recent", "never", "old", "recent-2"),
      new Map([
        ["recent", new Date(now.getTime() - DAY)],
        ["old", new Date(now.getTime() - (8 * DAY))],
        ["recent-2", new Date(now.getTime() - 2 * DAY)],
      ]),
      now,
      2,
    );

    expect(result).toEqual({
      candidates: [{ id: "never" }, { id: "old" }],
      staleExcluded: 2,
    });
  });

  it("keeps a thin pool full and orders fallback candidates oldest first", () => {
    const result = filterStaleExposures(
      candidates("recent", "never", "older-recent", "old"),
      new Map([
        ["recent", new Date(now.getTime() - DAY)],
        ["older-recent", new Date(now.getTime() - 2 * DAY)],
        ["old", new Date(now.getTime() - 8 * DAY)],
      ]),
      now,
      4,
    );

    expect(result).toEqual({
      candidates: [{ id: "never" }, { id: "old" }, { id: "older-recent" }, { id: "recent" }],
      staleExcluded: 0,
    });
  });
});
