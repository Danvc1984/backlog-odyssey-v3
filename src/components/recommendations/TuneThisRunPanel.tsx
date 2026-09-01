"use client";

import { useState } from "react";
import { toast } from "sonner";
import { clearTuneState, deleteRecommendationPreset, loadRecommendationPreset, saveRecommendationPreset, saveTuneState } from "@/actions/recommendations";
import type { TuneContext } from "@/lib/recommendations/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SourceIcon } from "@/components/sources/SourceIcon";

interface KnownValues {
  genres: string[];
  tags: string[];
}

interface TuneThisRunPanelProps {
  engine: "PLAY_NEXT" | "BUY";
  initialTune: TuneContext | null;
  knownValues: KnownValues;
  thinPool: boolean;
  presets: RecommendationPreset[];
  alternativeSources?: AlternativeSource[];
}

interface AlternativeSource {
  id: string;
  name: string;
  iconName: string;
}

interface RecommendationPreset {
  id: string;
  name: string;
}

const EXPERIENCE_OPTIONS = [
  ["PC_GAMING", "PC gaming"],
  ["MULTIPLAYER_COOP", "Multiplayer co-op"],
  ["COUCH_GAMING", "Couch gaming"],
  ["ON_THE_GO", "On the go"],
] as const;
const LENGTH_OPTIONS = [["SHORT", "Short"], ["MEDIUM", "Medium"], ["LONG", "Long"], ["VERY_LONG", "Very long"]] as const;
const ERA_OPTIONS = [["PRE_2005", "Before 2005"], ["Y2005_2014", "2005-2014"], ["Y2015_2019", "2015-2019"], ["Y2020_PLUS", "2020 or newer"]] as const;

function emptyTune(): TuneContext {
  return { experience: null, length: null, genres: [], tags: [], sequelPosture: null, era: null, maturity: null, sourceTune: null };
}

const selectClassName = "w-full";

interface MultiValuePickerProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiValuePicker({ label, options, selected, onChange }: MultiValuePickerProps) {
  const toggle = (value: string, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  };

  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <details className="group relative">
        <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-signal focus-visible:ring-3 focus-visible:ring-signal/30 dark:bg-input/30">
          <span>{selected.length === 0 ? "Any" : `${selected.length} selected`}</span>
          <span className="text-muted-foreground">⌄</span>
        </summary>
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-48 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <div className="flex items-center justify-between border-b border-border px-2 py-1">
            <span className="text-xs text-muted-foreground">Choose one or more</span>
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">Clear</button>
          </div>
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
              <input type="checkbox" checked={selected.includes(option)} onChange={(event) => toggle(option, event.target.checked)} className="accent-foreground" />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function TuneThisRunPanel({ engine, initialTune, knownValues, thinPool, presets, alternativeSources = [] }: TuneThisRunPanelProps) {
  const [tune, setTune] = useState<TuneContext>(initialTune ?? emptyTune());
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const title = engine === "PLAY_NEXT" ? "Tune play next" : "Tune buy recommendations";

  const update = <K extends keyof TuneContext>(key: K, value: TuneContext[K]) => {
    setTune((current) => ({ ...current, [key]: value }));
  };

  const sourceTune = tune.sourceTune ?? {
    steam: false,
    rom: false,
    allAlternatives: false,
    alternativeSourceIds: [],
  };

  const updateSourceTune = (key: "steam" | "rom" | "allAlternatives", checked: boolean) => {
    update("sourceTune", { ...sourceTune, [key]: checked });
  };

  const toggleAlternativeSource = (id: string, checked: boolean) => {
    update("sourceTune", {
      ...sourceTune,
      alternativeSourceIds: checked
        ? [...new Set([...sourceTune.alternativeSourceIds, id])]
        : sourceTune.alternativeSourceIds.filter((sourceId) => sourceId !== id),
    });
  };

  const save = async () => {
    setSaving(true);
    const result = await saveTuneState({ engine, tune });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save tune");
      return;
    }
    toast.success("Tune saved");
    window.location.reload();
  };

  const clear = async () => {
    setSaving(true);
    const result = await clearTuneState({ engine });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to clear tune");
      return;
    }
    toast.success("Tune cleared");
    window.location.reload();
  };

  const savePreset = async () => {
    if (!presetName.trim()) {
      toast.error("Enter a preset name");
      return;
    }
    setSaving(true);
    const result = await saveRecommendationPreset({ name: presetName, tune });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save preset");
      return;
    }
    toast.success("Preset saved");
    window.location.reload();
  };

  const loadPreset = async () => {
    if (!selectedPresetId) return;
    setSaving(true);
    const result = await loadRecommendationPreset({ id: selectedPresetId, engine });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to load preset");
      return;
    }
    toast.success("Preset loaded");
    window.location.reload();
  };

  const deletePreset = async () => {
    if (!selectedPresetId) return;
    setSaving(true);
    const result = await deleteRecommendationPreset({ id: selectedPresetId });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete preset");
      return;
    }
    toast.success("Preset deleted");
    window.location.reload();
  };

  return (
    <details open={Boolean(initialTune)} className="mb-4 rounded-lg border border-border">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        <span>{title}</span>
        {!initialTune && <span className="ml-2 text-xs font-normal text-muted-foreground">Opt-in</span>}
      </summary>
      <div className="grid gap-3 border-t border-border p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Experience
          <Select value={tune.experience ?? "ANY"} onValueChange={(value) => update("experience", value === "ANY" ? null : value as TuneContext["experience"])}>
            <SelectTrigger aria-label="Experience" className={selectClassName}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ANY">Any</SelectItem>{EXPERIENCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Length
          <Select value={tune.length ?? "ANY"} onValueChange={(value) => update("length", value === "ANY" ? null : value as TuneContext["length"])}>
            <SelectTrigger aria-label="Length" className={selectClassName}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ANY">Any</SelectItem>{LENGTH_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Sequel posture
          <Select value={tune.sequelPosture ?? "ANY"} onValueChange={(value) => update("sequelPosture", value === "ANY" ? null : value as TuneContext["sequelPosture"])}>
            <SelectTrigger aria-label="Sequel posture" className={selectClassName}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ANY">Any</SelectItem><SelectItem value="SEQUEL">Sequel</SelectItem><SelectItem value="STANDALONE">Standalone</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Era
          <Select value={tune.era ?? "ANY"} onValueChange={(value) => update("era", value === "ANY" ? null : value as TuneContext["era"])}>
            <SelectTrigger aria-label="Era" className={selectClassName}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ANY">Any</SelectItem>{ERA_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Maturity
          <Select value={tune.maturity ?? "ANY"} onValueChange={(value) => update("maturity", value === "ANY" ? null : value as TuneContext["maturity"])}>
            <SelectTrigger aria-label="Maturity" className={selectClassName}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ANY">Any</SelectItem><SelectItem value="CASUAL">Casual</SelectItem><SelectItem value="MATURE">Mature</SelectItem></SelectContent>
          </Select>
        </label>
        <MultiValuePicker label="Genres" options={knownValues.genres} selected={tune.genres} onChange={(values) => update("genres", values)} />
        <MultiValuePicker label="Tags" options={knownValues.tags} selected={tune.tags} onChange={(values) => update("tags", values)} />
        {engine === "PLAY_NEXT" && (
          <fieldset className="grid gap-2 text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
            <legend>Sources</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={sourceTune.steam} onChange={(event) => updateSourceTune("steam", event.target.checked)} className="accent-foreground" />
                <SourceIcon iconName="MonitorPlay" />
                Steam
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={sourceTune.rom} onChange={(event) => updateSourceTune("rom", event.target.checked)} className="accent-foreground" />
                <SourceIcon iconName="Disc3" />
                ROM
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={sourceTune.allAlternatives} onChange={(event) => updateSourceTune("allAlternatives", event.target.checked)} className="accent-foreground" />
                <SourceIcon iconName="Box" />
                Any alternative source
              </label>
              {alternativeSources.map((source) => (
                <label key={source.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={sourceTune.alternativeSourceIds.includes(source.id)} onChange={(event) => toggleAlternativeSource(source.id, event.target.checked)} className="accent-foreground" />
                  <SourceIcon iconName={source.iconName} />
                  {source.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
          <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-foreground px-3 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save tune"}</button>
          <button type="button" onClick={() => void clear()} disabled={saving || !initialTune} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Clear tune</button>
        </div>
        <div className="grid gap-2 border-t border-border pt-3 md:col-span-2 xl:col-span-4">
          <span className="text-xs text-muted-foreground">Presets</span>
          <div className="flex flex-wrap gap-2">
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" maxLength={100} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" aria-label="Preset name" />
            <button type="button" onClick={() => void savePreset()} disabled={saving} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Save preset</button>
            <Select value={selectedPresetId || "NONE"} onValueChange={(value) => setSelectedPresetId(value === "NONE" ? "" : value)}>
              <SelectTrigger aria-label="Saved presets" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NONE">Choose preset</SelectItem>{presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}</SelectContent>
            </Select>
            <button type="button" onClick={() => void loadPreset()} disabled={saving || !selectedPresetId} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Load preset</button>
            <button type="button" onClick={() => void deletePreset()} disabled={saving || !selectedPresetId} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Delete preset</button>
          </div>
        </div>
        {thinPool && <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">This tune matched fewer candidates than this engine displays, so other eligible items remain visible.</p>}
      </div>
    </details>
  );
}
