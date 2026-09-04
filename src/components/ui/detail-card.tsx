import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "signal" | "opportunity" | "warning" | "danger";

const CARD_TONES: Record<CardTone, string> = {
  default: "border-border bg-card",
  signal: "border-signal/40 bg-gradient-to-br from-signal/10 via-card to-card",
  opportunity: "border-opportunity/40 bg-gradient-to-br from-opportunity/10 via-card to-card",
  warning: "border-warning/40 bg-gradient-to-br from-warning/10 via-card to-card",
  danger: "border-red-500/40 bg-gradient-to-br from-red-500/10 via-card to-card",
};

export type StatusPillTone =
  | "neutral"
  | "ok"
  | "signal"
  | "opportunity"
  | "warning"
  | "danger";

const STATUS_PILL_TONES: Record<StatusPillTone, string> = {
  neutral: "bg-muted/40 text-muted-foreground",
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  signal: "bg-signal/15 text-signal-strong",
  opportunity: "bg-opportunity/15 text-opportunity-text",
  warning: "bg-warning/15 text-warning-text",
  danger: "bg-red-500/15 text-red-600 dark:text-red-300",
};

export function StatusPill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusPillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "game-theme-status-pill inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-technical text-[10px] leading-4",
        STATUS_PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  eyebrow,
  title,
  id,
  description,
  status,
  aside,
  footer,
  tone = "default",
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  id?: string;
  description?: ReactNode;
  status?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        `game-theme-section-card game-theme-section-card--${tone} rounded-lg border shadow-card`,
        CARD_TONES[tone],
        className,
      )}
    >
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="technical-label text-muted-foreground">{eyebrow}</p>
            <h2 id={id} className="mt-1 text-xl font-bold tracking-[-0.03em]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            )}
          </div>
          {(status || aside) && (
            <div className="flex shrink-0 flex-col items-end gap-2">{status}
              {aside}
            </div>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border p-5 pt-3">
          {footer}
        </div>
      )}
    </section>
  );
}
