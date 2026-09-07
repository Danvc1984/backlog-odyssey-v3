import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { compatEvidenceFor } from "./pipeline-helpers";

describe("compatEvidenceFor", () => {
  it("maps the personal compatibility override and reason", () => {
    expect(
      compatEvidenceFor({
        externalIds: [{ externalId: "730" }],
        availability: [{ source: "STEAM" }],
        libraryEntry: { compatOverrideStatus: "READY", compatOverrideReason: "Tested on Deck" },
        compatSnapshots: [],
      }),
    ).toMatchObject({
      overrideStatus: "READY",
      overrideReason: "Tested on Deck",
    });
  });
});
