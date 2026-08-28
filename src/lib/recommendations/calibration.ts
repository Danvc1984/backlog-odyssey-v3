import type { ExplanationFactor } from "./types";
import {
  CALIBRATION_DISMISSALS_PER_POINT,
  CALIBRATION_POINTS_PER_INTEREST,
} from "./types";

export function calibratedInterest(interest: number | null, dismissalCount: number): number | null {
  if (interest === null) return null;
  const dismissedSteps = Math.floor(Math.max(0, dismissalCount) / CALIBRATION_DISMISSALS_PER_POINT);
  return Math.max(0, interest - dismissedSteps);
}

export function buildCalibrationFactor(
  interest: number | null,
  dismissalCount: number,
): ExplanationFactor | null {
  const adjusted = calibratedInterest(interest, dismissalCount);
  if (interest === null || adjusted === null || adjusted === interest) return null;
  return {
    factor: "calibration",
    label: `Dismissed ${dismissalCount} times`,
    points: -(interest - adjusted) * CALIBRATION_POINTS_PER_INTEREST,
  };
}
