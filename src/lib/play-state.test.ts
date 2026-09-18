import { describe, expect, it } from "vitest";
import { derivePlayStateMutation } from "./play-state";

describe("derivePlayStateMutation", () => {
  it("preserves completion history when leaving completed", () => {
    expect(
      derivePlayStateMutation(
        { playState: "COMPLETED" },
        { playState: "ABANDONED", completedBefore: false },
      ),
    ).toEqual({ playState: "ABANDONED", completedBefore: true });
  });

  it("consumes replay when entering in progress", () => {
    expect(
      derivePlayStateMutation(
        { playState: "ABANDONED" },
        { playState: "IN_PROGRESS", replayCandidate: true },
      ),
    ).toEqual({ playState: "IN_PROGRESS", replayCandidate: false });
  });

  it("allows an explicit history correction without a state change", () => {
    expect(
      derivePlayStateMutation(
        { playState: "IN_PROGRESS" },
        { completedBefore: false },
      ),
    ).toEqual({ completedBefore: false });
  });

  it("lets a same-state completion correction clear history", () => {
    expect(
      derivePlayStateMutation(
        { playState: "COMPLETED" },
        { playState: "COMPLETED", completedBefore: false },
      ),
    ).toEqual({ playState: "COMPLETED", completedBefore: false });
  });
});
