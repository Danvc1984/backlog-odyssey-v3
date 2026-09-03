import { icons, type LucideIcon } from "lucide-react"
import { FALLBACK_SOURCE_ICON } from "@/lib/sources/known-sources"

const iconMap = icons as Record<string, LucideIcon>

export function SourceIcon({ iconName }: { iconName: string }) {
  const Icon = iconMap[iconName] ?? iconMap[FALLBACK_SOURCE_ICON]
  return <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
}
