"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  addGameAvailability,
  removeGameAvailability,
  updateGameAvailability,
} from "@/actions/game-detail"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SourceIcon } from "@/components/sources/SourceIcon"
import {
  createAlternativeSource,
} from "@/actions/sources"
import {
  availabilitySourcePresentation,
  suggestSources,
  type AvailabilitySource,
} from "@/lib/sources/known-sources"

interface AvailabilityRow {
  id: string
  source: AvailabilitySource
  alternativeSourceId: string | null
  displayName: string | null
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
  const [savingId, setSavingId] = useState<string | null>(null)
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((row) => [row.id, row.displayName ?? ""])),
  )
  const [sourceQuery, setSourceQuery] = useState("")
  const [sourceListOpen, setSourceListOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)

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
      toast.error(result.error ?? "Failed to update availability")
      return
    }
    toast.success(checked ? "Availability added" : "Availability removed")
    router.refresh()
  }

  const saveDisplayName = async (row: AvailabilityRow) => {
    if (savingId) return
    setSavingId(row.id)
    const result = await updateGameAvailability(row.id, {
      displayName: displayNames[row.id] ?? "",
    })
    setSavingId(null)
    if (!result.success) {
      toast.error(result.error ?? "Failed to save availability")
      return
    }
    toast.success("Availability saved")
    router.refresh()
  }

  const sourceSuggestions = suggestSources(sourceQuery, savedSources)

  const addSource = async (name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName || busyKey) return
    setBusyKey("new-source")
    const sourceResult = await createAlternativeSource({ name: trimmedName })
    if (!sourceResult.success) {
      setBusyKey(null)
      toast.error(sourceResult.error ?? "Failed to create source")
      return
    }
    const availabilityResult = await addGameAvailability(gameId, {
      source: "OTHER_PLATFORM",
      alternativeSourceId: sourceResult.data.id,
    })
    setBusyKey(null)
    if (!availabilityResult.success) {
      toast.error(availabilityResult.error ?? "Failed to add availability")
      return
    }
    setSourceQuery("")
    setSourceListOpen(false)
    toast.success("Availability added")
    router.refresh()
  }

  const handleSourceKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestions = sourceSuggestions.known
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSourceListOpen(true)
      setActiveSuggestion((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveSuggestion((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const suggestion = suggestions[activeSuggestion]
      void addSource(suggestion?.label ?? sourceQuery)
    } else if (event.key === "Escape") {
      setSourceListOpen(false)
    }
  }

  return (
    <div className="grid gap-3 p-4">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No availability records.</p>
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
                  <SourceIcon iconName={presentation.iconName} />
                  <span className="truncate">{presentation.label}</span>
                </label>
                {syncedSteam && <span className="text-xs text-muted-foreground">Synced</span>}
              </div>
              {row && (
                <div className="mt-3 grid gap-2 pl-7">
                  <label htmlFor={`availability-name-${row.id}`} className="text-xs text-muted-foreground">Display name</label>
                  <Input
                    id={`availability-name-${row.id}`}
                    value={displayNames[row.id] ?? ""}
                    onChange={(event) => setDisplayNames((current) => ({ ...current, [row.id]: event.target.value }))}
                    disabled={savingId !== null}
                    placeholder="Optional platform-specific name"
                  />
                  <Button type="button" className="w-fit" size="sm" disabled={savingId !== null} onClick={() => void saveDisplayName(row)}>
                    {savingId === row.id ? "Saving..." : "Save availability"}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="grid gap-2">
        <label htmlFor="add-availability-source" className="text-sm font-medium">
          Add a source not listed
        </label>
        <div className="relative">
          <Input
            id="add-availability-source"
            value={sourceQuery}
            placeholder="Type a store or alias..."
            disabled={busyKey !== null}
            onFocus={() => setSourceListOpen(true)}
            onChange={(event) => {
              setSourceQuery(event.target.value)
              setActiveSuggestion(0)
              setSourceListOpen(true)
            }}
            onKeyDown={handleSourceKeyDown}
          />
          {sourceListOpen && sourceSuggestions.known.length > 0 && (
            <ul role="listbox" className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
              {sourceSuggestions.known.map((suggestion, index) => (
                <li key={suggestion.key} role="option" aria-selected={index === activeSuggestion}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void addSource(suggestion.label)}
                  >
                    <SourceIcon iconName={suggestion.iconName} />
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {sourceSuggestions.matchesSaved && (
          <p className="text-xs text-muted-foreground">This source is already saved.</p>
        )}
      </div>
    </div>
  )
}
