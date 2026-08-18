"use client";

import { useEffect } from "react";
import { getActiveOperations } from "@/actions/catalog-operations";
import { showCatalogOperationToast, useUndoOperation } from "./CatalogOperationToast";

export function ActiveOperationsWatcher() {
  const undo = useUndoOperation();

  useEffect(() => {
    let cancelled = false;
    void getActiveOperations().then((result) => {
      if (cancelled || !result.success || result.data.length === 0) return;
      for (const operation of result.data) {
        showCatalogOperationToast(
          {
            operationId: operation.id,
            expiresAt: new Date(operation.expiresAt),
          },
          () => void undo(operation.id),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [undo]);

  return null;
}