import { describe, expect, it } from "vitest";
import { buildCalibrationFactor, calibratedInterest } from "./calibration";

describe("calibration", () => {
  it.each([
    [0, 5],
    [2, 5],
    [3, 4],
    [6, 3],
    [9, 2],
  ])("lowers interest one step per three dismissals", (dismissals, expected) => {
    expect(calibratedInterest(5, dismissals)).toBe(expected);
  });

  it("clamps the adjusted interest at zero", () => {
    expect(calibratedInterest(2, 99)).toBe(0);
  });

  it("keeps null interest as null", () => {
    expect(calibratedInterest(null, 99)).toBeNull();
    expect(buildCalibrationFactor(null, 99)).toBeNull();
  });

  it("builds a negative factor only when a dismissal step applies", () => {
    expect(buildCalibrationFactor(5, 2)).toBeNull();
    expect(buildCalibrationFactor(5, 3)).toEqual({
      factor: "calibration",
      label: "Dismissed 3 times",
      points: -10,
    });
    expect(buildCalibrationFactor(2, 99)).toEqual({
      factor: "calibration",
      label: "Dismissed 99 times",
      points: -20,
    });
  });
});
