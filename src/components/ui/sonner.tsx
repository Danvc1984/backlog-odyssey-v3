"use client";

import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, type ExternalToast, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import {
  catalogToastId,
  catalogToastRegistry,
} from "@/lib/catalog-toast-registry";

export const CATALOG_ACTION_TOASTER_ID = "catalog-action";
export const CATALOG_UNDO_TOASTER_ID = "catalog-undo";

type CatalogActionType = "success" | "error";

function releaseCatalogToast(kind: "action" | "undo", operationId: string) {
  catalogToastRegistry.release(kind, operationId);
}

function catalogToastOptions(
  kind: "action" | "undo",
  operationId: string,
  options: ExternalToast,
): ExternalToast {
  return {
    ...options,
    id: catalogToastId(kind, operationId),
    toasterId: kind === "action" ? CATALOG_ACTION_TOASTER_ID : CATALOG_UNDO_TOASTER_ID,
    closeButton: true,
    onDismiss: () => releaseCatalogToast(kind, operationId),
    onAutoClose: () => releaseCatalogToast(kind, operationId),
  };
}

export function showCatalogActionToast(
  operationId: string,
  message: ReactNode,
  type: CatalogActionType = "success",
) {
  if (!catalogToastRegistry.claim("action", operationId)) return false;

  toast[type](
    message,
    catalogToastOptions("action", operationId, { duration: 5_000 }),
  );
  return true;
}

export function replaceCatalogActionToast(
  operationId: string,
  message: ReactNode,
  type: CatalogActionType = "success",
) {
  if (!catalogToastRegistry.has("action", operationId)) {
    catalogToastRegistry.claim("action", operationId);
  }

  toast[type](
    message,
    catalogToastOptions("action", operationId, { duration: 5_000 }),
  );
}

export function showCatalogUndoToast(
  operationId: string,
  message: ReactNode,
  expiresAt: Date,
) {
  const duration = expiresAt.getTime() - Date.now();
  if (duration <= 0 || !catalogToastRegistry.claim("undo", operationId)) return false;

  toast(
    message,
    catalogToastOptions("undo", operationId, { duration }),
  );
  return true;
}

export function dismissCatalogUndoToast(operationId: string) {
  toast.dismiss(catalogToastId("undo", operationId));
  releaseCatalogToast("undo", operationId);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  const sharedProps: ToasterProps = {
    theme: theme as ToasterProps["theme"],
    className: "toaster group",
    duration: 5000,
    icons: {
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    },
    style: {
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--border-radius": "var(--radius)",
    } as React.CSSProperties,
    toastOptions: {
      classNames: {
        toast: "cn-toast",
      },
      closeButton: true,
    },
  };

  return (
    <>
      <Sonner {...sharedProps} {...props} position="bottom-right" />
      <Sonner
        {...sharedProps}
        id={CATALOG_ACTION_TOASTER_ID}
        position="bottom-right"
        offset={{ bottom: 96 }}
        mobileOffset={{ bottom: 96 }}
        containerAriaLabel="Catalog action notifications"
      />
      <Sonner
        {...sharedProps}
        id={CATALOG_UNDO_TOASTER_ID}
        position="bottom-right"
        offset={{ bottom: 176 }}
        mobileOffset={{ bottom: 176 }}
        containerAriaLabel="Catalog Undo notifications"
      />
    </>
  );
};

export { Toaster };
