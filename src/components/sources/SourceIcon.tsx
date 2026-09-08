import { LEGACY_FALLBACK_ICON_NAME, LEGACY_ICON_REGISTRY } from "@/lib/icons/icon-registry"
import { FALLBACK_SOURCE_ICON } from "@/lib/sources/known-sources"

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
  const Icon = LEGACY_ICON_REGISTRY[iconName] ?? LEGACY_ICON_REGISTRY[LEGACY_FALLBACK_ICON_NAME]
  const colorClass =
    iconName === FALLBACK_SOURCE_ICON || iconName === "Disc3"
      ? "text-signal-strong"
      : "text-muted-foreground"
  return <Icon aria-hidden className={`size-4 shrink-0 ${colorClass}`} />
}