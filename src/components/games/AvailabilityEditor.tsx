"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  addGameAvailability,
  removeGameAvailability,
} from "@/actions/game-detail"
import { Checkbox } from "@/components/ui/checkbox"
import { SourceIcon } from "@/components/sources/SourceIcon"
import {
  availabilitySourcePresentation,
  type AvailabilitySource,
} from "@/lib/sources/known-sources"

interface AvailabilityRow {
  id: string
  source: AvailabilitySource
  alternativeSourceId: string | null
  steamAppId: string | null
  steamPlaytimeTotal: bigint | null
  steamLastPlayed: Date | null
}

interface SavedSource {
  id: string
  name: string
  archivedAt: Date | null
}

interface AvailabilityEditorProps {
  gameId: string
  rows: AvailabilityRow[]
  savedSources: SavedSource[]
}

type SourceOption = {
  key: string
  source: AvailabilitySource
  alternativeSourceId: string | null
  name: string | null
  archived: boolean
}

export function AvailabilityEditor({ gameId, rows, savedSources }: AvailabilityEditorProps) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const rowBySource = new Map(
    rows.map((row) => [
      row.source === "OTHER_PLATFORM" ? `alt:${row.alternativeSourceId}` : row.source,
      row,
    ]),
  )
  const options: SourceOption[] = [
    { key: "STEAM", source: "STEAM", alternativeSourceId: null, name: null, archived: false },
    { key: "ROM", source: "ROM", alternativeSourceId: null, name: null, archived: false },
    ...savedSources
      .filter((source) => !source.archivedAt || rowBySource.has(`alt:${source.id}`))
      .map((source) => ({
        key: `alt:${source.id}`,
        source: "OTHER_PLATFORM" as const,
        alternativeSourceId: source.id,
        name: source.name,
        archived: source.archivedAt !== null,
      })),
  ]

  const toggle = async (option: SourceOption, checked: boolean) => {
    if (busyKey) return
    setBusyKey(option.key)
    const row = rowBySource.get(option.key)
    const result = checked
      ? await addGameAvailability(gameId, {
          source: option.source,
          ...(option.alternativeSourceId && { alternativeSourceId: option.alternativeSourceId }),
        } as never)
      : row
        ? await removeGameAvailability(row.id)
        : null
    setBusyKey(null)
    if (!result) return
    if (!result.success) {
      toast.error(result.error ?? "Failed to update platform")
      return
    }
    toast.success(checked ? "Platform added" : "Platform removed")
    router.refresh()
  }

  return (
    <div className="grid gap-3 p-4">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No platform records.</p>
      )}
      {savedSources.every((source) => source.archivedAt !== null) && (
        <p className="text-sm text-muted-foreground">
          Need another platform? Create an active reusable source in{" "}
          <Link href="/settings#alternative-sources-heading" className="underline underline-offset-2">
            Settings
          </Link>.
        </p>
      )}
      <div className="grid gap-2">
        {options.map((option) => {
          const row = rowBySource.get(option.key)
          const presentation = availabilitySourcePresentation(option.source, option.name)
          const syncedSteam = option.source === "STEAM" && row && (
            row.steamAppId !== null || row.steamPlaytimeTotal !== null || row.steamLastPlayed !== null
          )
          return (
            <div key={option.key} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`availability-${option.key}`}
                  checked={row !== undefined}
                  disabled={busyKey !== null || syncedSteam}
                  title={syncedSteam ? "Steam statistics are synchronized" : undefined}
                  onCheckedChange={(checked) => void toggle(option, checked === true)}
                />
                <label htmlFor={`availability-${option.key}`} className="flex min-w-0 items-center gap-2 text-sm">
                  <SourceIcon iconName={presentation.iconName} brandIcon={presentation.brandIcon} />
                  <span className="truncate">{presentation.label}</span>
                </label>
                {syncedSteam && <span className="text-xs text-muted-foreground">Synced</span>}
                {option.archived && <span className="text-xs text-muted-foreground">Archived</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
