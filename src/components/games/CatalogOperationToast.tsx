"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { undoOperation } from "@/actions/catalog-operations";

export interface CatalogOperationSummary {
  operationId: string;
  expiresAt: Date;
}

export function useUndoOperation() {
  const router = useRouter();
  return useCallback(
    async (operationId: string) => {
      const result = await undoOperation({ operationId });
      dismissCatalogOperationToast(operationId);
      if (result.success) {
        toast.success("Change undone");
      } else {
        toast.error(result.error ?? "Failed to undo");
      }
      router.refresh();
    },
    [router],
  );
}

function secondsLeft(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

function PendingOperationToast({
  operation,
  onUndo,
  onExpired,
}: {
  operation: CatalogOperationSummary;
  onUndo?: () => void;
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState(() => secondsLeft(operation.expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      const left = secondsLeft(operation.expiresAt);
      setRemaining(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [operation.expiresAt]);

  useEffect(() => {
    if (remaining <= 0) onExpired?.();
  }, [remaining, onExpired]);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span>
        Change applied. You can undo this for {remaining}s.
      </span>
      {onUndo && (
        <Button type="button" size="sm" onClick={onUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

const operationToastIds = new Map<string, string>();

export function dismissCatalogOperationToast(operationId: string) {
  const toastId = operationToastIds.get(operationId);
  if (!toastId) return;
  toast.dismiss(toastId);
  operationToastIds.delete(operationId);
}

export function showCatalogOperationToast(
  operation: CatalogOperationSummary,
  onUndo?: () => void,
) {
  if (operationToastIds.has(operation.operationId)) return;
  const toastId = `catalog-operation-${operation.operationId}`;
  operationToastIds.set(operation.operationId, toastId);
  toast(
    <PendingOperationToast
      operation={operation}
      onUndo={onUndo}
      onExpired={() => dismissCatalogOperationToast(operation.operationId)}
    />,
    {
      id: toastId,
      duration: 30_000,
      closeButton: true,
    },
  );
}