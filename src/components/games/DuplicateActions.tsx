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

  const handleScan = async () => {
    setScanning(true);
    const result = await detectDuplicates();
    setScanning(false);

    if (result.success) {
      toast.success(`Found ${result.data.duplicatesFound} new duplicates`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to scan for duplicates");
    }
  };

  return (
    <Button type="button" onClick={handleScan} disabled={scanning}>
      <ScanSearch />
      {scanning ? "Scanning..." : "Scan for duplicates"}
    </Button>
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
