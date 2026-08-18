"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dismissDuplicate, detectDuplicates } from "@/actions/duplicates";
import { Button } from "@/components/ui/button";
import { ScanSearch } from "lucide-react";

export function ScanDuplicatesButton() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [includeDismissed, setIncludeDismissed] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    const result = await detectDuplicates({ includeDismissed });
    setScanning(false);

    if (result.success) {
      toast.success(`Found ${result.data.duplicatesFound} duplicates to review`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to scan for duplicates");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeDismissed}
          onChange={(event) => setIncludeDismissed(event.target.checked)}
          className="h-4 w-4"
        />
        Re-check dismissed
      </label>
      <Button type="button" onClick={handleScan} disabled={scanning}>
        <ScanSearch />
        {scanning ? "Scanning..." : "Scan for duplicates"}
      </Button>
    </div>
  );
}

export function DismissDuplicateButton({ duplicateId }: { duplicateId: string }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    const result = await dismissDuplicate(duplicateId);
    setDismissing(false);

    if (result.success) {
      toast.success("Duplicate dismissed");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to dismiss duplicate");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDismiss}
      disabled={dismissing}
    >
      {dismissing ? "Dismissing..." : "Dismiss"}
    </Button>
  );
}
