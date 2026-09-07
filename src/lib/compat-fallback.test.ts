import { describe, expect, it } from "vitest";

import { deriveWindowsFallback } from "./compat-fallback";

describe("deriveWindowsFallback", () => {
  it("describes Linux evidence without changing the fallback status", () => {
    expect(deriveWindowsFallback("READY_WITH_TINKERING", null)).toEqual({
      status: "FALLBACK_RECOMMENDED",
      label: "Fallback recommended",
      source: "Windows fallback is recommended because Linux needs tinkering according to ProtonDB.",
    });
  });

  it("keeps AWAY failures as required fallback evidence", () => {
    expect(deriveWindowsFallback("READY", "Denied")).toEqual({
      status: "REQUIRED",
      label: "Fallback required",
      source: "Windows fallback is required because AWAY reports Linux anti-cheat as Denied.",
    });
  });
});
