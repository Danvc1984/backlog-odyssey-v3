import { describe, expect, it } from "vitest";
import { parseHasDlcFilter } from "./library-has-dlc-filter";

describe("parseHasDlcFilter", () => {
  it("accepts the active URL value", () => {
    expect(parseHasDlcFilter("true")).toBe(true);
  });

  it("ignores missing and invalid values", () => {
    expect(parseHasDlcFilter()).toBeUndefined();
    expect(parseHasDlcFilter("false")).toBeUndefined();
    expect(parseHasDlcFilter("yes")).toBeUndefined();
  });
});
