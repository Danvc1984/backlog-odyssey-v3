"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryEnrichmentJob } from "@/actions/enrichment-retry";
import { Button } from "@/components/ui/button";

export function EnrichmentRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const handleRetry = () => {
    setRunning(true);
    startTransition(async () => {
      const result = await retryEnrichmentJob({ jobId });
      setRunning(false);
      if (!result.success) {
        toast.error(result.error ?? "Failed to retry job");
        return;
      }
      router.refresh();
      toast.success("Job retried");
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={handleRetry}
      disabled={pending || running}
    >
      {running ? "Retrying..." : "Retry"}
    </Button>
  );
}
