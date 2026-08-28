import { calibratedInterest } from "@/lib/recommendations/calibration";

interface CalibrationNoteProps {
  interest: number | null;
  dismissalCount: number;
}

export function CalibrationNote({ interest, dismissalCount }: CalibrationNoteProps) {
  const adjustedInterest = calibratedInterest(interest, dismissalCount);

  if (interest === null || adjustedInterest === null || adjustedInterest === interest) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground">
      Interest shown as adjusted: you dismissed this recommendation {dismissalCount} times ({interest} -&gt; {adjustedInterest}).
    </p>
  );
}
