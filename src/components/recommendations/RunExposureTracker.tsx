"use client";

import { useEffect } from "react";
import { recordRunExposure } from "@/actions/recommendations";

interface RunExposureTrackerProps {
  runId: string;
  items: Array<{ gameId?: string; wishlistEntryId?: string; role?: string }>;
}

export function RunExposureTracker({ runId, items }: RunExposureTrackerProps) {
  const itemKey = JSON.stringify(items);
  useEffect(() => {
    void recordRunExposure({ runId, items: JSON.parse(itemKey) }).catch(() => undefined);
  }, [runId, itemKey]);

  return null;
}
