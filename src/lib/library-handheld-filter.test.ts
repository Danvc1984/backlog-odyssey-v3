import { describe, expect, it } from "vitest";
import { parseHandheldSuitabilityFilter } from "./library-handheld-filter";

describe("parseHandheldSuitabilityFilter", () => {
  it("maps marked to true", () => {
    expect(parseHandheldSuitabilityFilter("marked")).toBe(true);
  });

  it("maps unmarked to null", () => {
    expect(parseHandheldSuitabilityFilter("unmarked")).toBeNull();
  });

  it("ignores absent and unknown values", () => {
    expect(parseHandheldSuitabilityFilter()).toBeUndefined();
    expect(parseHandheldSuitabilityFilter("suitable")).toBeUndefined();
    expect(parseHandheldSuitabilityFilter("not-suitable")).toBeUndefined();
  });
});
