import { icons, type LucideIcon } from "lucide-react"
import { FALLBACK_SOURCE_ICON } from "@/lib/sources/known-sources"

const iconMap = icons as Record<string, LucideIcon>

export function SourceIcon({ iconName, brandIcon }: { iconName: string; brandIcon?: string }) {
  if (brandIcon) {
    return (
      <span
        aria-hidden
        data-brand-icon={brandIcon}
        className="source-brand-icon size-4 shrink-0 bg-signal-strong"
      />
    )
  }
  const Icon = iconMap[iconName] ?? iconMap[FALLBACK_SOURCE_ICON]
  const colorClass =
    iconName === FALLBACK_SOURCE_ICON || iconName === "Disc3"
      ? "text-signal-strong"
      : "text-muted-foreground"
  return <Icon aria-hidden className={`size-4 shrink-0 ${colorClass}`} />
}
