import { describe, expect, it } from "vitest";

import { recommendationCopy } from "./recommendation-copy";

describe("recommendationCopy", () => {
  it("composes a sentence from opener and caveat labels", () => {
    expect(
      recommendationCopy({
        kind: "PLAY_NEXT",
        role: "BEST_FIT_1",
        positive: [],
        caveats: [{ factor: "preference", label: "high interest" }],
      }),
    ).toBe("A direct best fit for your rotation — high interest.");
  });

  it("caps the reasons at two and favors caveats first", () => {
    expect(
      recommendationCopy({
        kind: "PLAY_NEXT",
        role: "CHANGE_OF_PACE",
        positive: [{ factor: "interest", label: "high interest", points: 20 }],
        caveats: [
          { factor: "compat_bazzite", label: "runs well on Bazzite" },
          { factor: "preference", label: "short session" },
          { factor: "source_tune", label: "ROM available" },
        ],
      }),
    ).toBe(
      "A change of pace when you want a deliberate reset — runs well on Bazzite · short session.",
    );
  });

  it("fills with a positive factor when there are no caveats", () => {
    expect(
      recommendationCopy({
        kind: "BUY",
        role: "DEAL",
        positive: [{ factor: "offer_discount", label: "fresh 20% discount", points: 12 }],
        caveats: [],
      }),
    ).toBe("A deal worth acting on now — fresh 20% discount.");
  });

  it("falls back to a kind-based opener without a role", () => {
    expect(
      recommendationCopy({
        kind: "BUY",
        role: null,
        positive: [],
        caveats: [{ factor: "target_hit", label: "under your target price" }],
      }),
    ).toBe("Recommended for your wallet right now — under your target price.");
  });

  it("returns null when there is nothing to say", () => {
    expect(
      recommendationCopy({ kind: "PLAY_NEXT", role: "BEST_FIT_1", positive: [], caveats: [] }),
    ).toBeNull();
  });
});