"use client";

import { InfoIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export function InfoPopover({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const popoverId = `info-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More information about ${label}`}
        aria-expanded={open}
        aria-controls={popoverId}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon aria-hidden="true" className="size-4" />
      </button>
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={`${label} information`}
          className="absolute left-0 top-full z-50 mt-2 w-max max-w-64 rounded-md border border-border bg-popover p-2 pr-7 text-xs leading-5 text-popover-foreground shadow-lg"
        >
          <p>{content}</p>
          <button
            ref={closeRef}
            type="button"
            aria-label={`Close ${label} information`}
            className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
    </span>
  );
}
