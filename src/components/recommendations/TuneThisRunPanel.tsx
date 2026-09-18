"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CaretDownIcon } from "@phosphor-icons/react";
import { deleteRecommendationPreset, loadRecommendationPreset, saveRecommendationPreset } from "@/actions/recommendations";
import { normalizeTuneContext, tuneContextSchema, type TuneContext } from "@/lib/recommendations/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SourceIcon } from "@/components/sources/SourceIcon";

interface KnownValues { genres: string[]; tags: string[]; personalTags: string[] }
interface TuneThisRunPanelProps {
  engine: "PLAY_NEXT" | "BUY";
  knownValues: KnownValues;
  thinPool: boolean;
  presets: RecommendationPreset[];
  alternativeSources?: AlternativeSource[];
}
interface AlternativeSource { id: string; name: string; iconName: string; brandIcon?: string }
interface RecommendationPreset { id: string; name: string }

const STORAGE_PREFIX = "backlog-odyssey:tune:";
const TIME_OPTIONS = [["UNDER_6", "Under 6h"], ["6_20", "6-20h"], ["20_50", "20-50h"], ["OVER_50", "50+h"]] as const;
const EXPERIENCE_OPTIONS = [["PC_GAMING", "PC gaming"], ["MULTIPLAYER_COOP", "Multiplayer co-op"], ["COUCH_GAMING", "Couch gaming"], ["ON_THE_GO", "On the go"]] as const;
const ERA_OPTIONS = [["PRE_2005", "Before 2005"], ["Y2005_2014", "2005-2014"], ["Y2015_2019", "2015-2019"], ["Y2020_PLUS", "2020 or newer"]] as const;

function emptyTune(): TuneContext {
  return { time: null, playStyle: null, familiarity: "BALANCED", handheld: false, experience: null, genres: [], tags: [], personalTags: [], sequelPosture: null, era: null, maturity: null, sourceTune: null };
}

function storageKey(engine: TuneThisRunPanelProps["engine"]): string { return `${STORAGE_PREFIX}${engine}`; }

const selectClassName = "w-full";

interface MultiValuePickerProps { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }
function MultiValuePicker({ label, options, selected, onChange }: MultiValuePickerProps) {
  const toggle = (value: string, checked: boolean) => onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <details className="group relative">
        <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-signal focus-visible:ring-3 focus-visible:ring-signal/30 dark:bg-input/30">
          <span>{selected.length === 0 ? "Any" : `${selected.length} selected`}</span><CaretDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-48 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <div className="flex items-center justify-between border-b border-border px-2 py-1"><span className="text-xs text-muted-foreground">Choose one or more</span><button type="button" onClick={() => onChange([])} disabled={selected.length === 0} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">Clear</button></div>
          {options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => toggle(option, event.target.checked)} className="accent-foreground" /><span>{option}</span></label>)}
        </div>
      </details>
    </div>
  );
}

export function TuneThisRunPanel({ engine, knownValues, thinPool, presets, alternativeSources = [] }: TuneThisRunPanelProps) {
  const [tune, setTune] = useState<TuneContext>(emptyTune());
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const update = <K extends keyof TuneContext>(key: K, value: TuneContext[K]) => setTune((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey(engine));
      const parsed = stored ? tuneContextSchema.safeParse(JSON.parse(stored)) : null;
      if (parsed?.success) queueMicrotask(() => setTune(parsed.data));
    } catch {
      sessionStorage.removeItem(storageKey(engine));
    }
    queueMicrotask(() => setHydrated(true));
  }, [engine]);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(storageKey(engine), JSON.stringify(tune));
  }, [engine, hydrated, tune]);

  const sourceTune = tune.sourceTune ?? { steam: false, rom: false, allAlternatives: false, alternativeSourceIds: [] };
  const updateSourceTune = (key: "steam" | "rom" | "allAlternatives", checked: boolean) => update("sourceTune", { ...sourceTune, [key]: checked });
  const toggleAlternativeSource = (id: string, checked: boolean) => update("sourceTune", { ...sourceTune, alternativeSourceIds: checked ? [...new Set([...sourceTune.alternativeSourceIds, id])] : sourceTune.alternativeSourceIds.filter((sourceId) => sourceId !== id) });
  const reset = () => setTune(emptyTune());

  const savePreset = async () => {
    if (!presetName.trim()) { toast.error("Enter a preset name"); return; }
    setSaving(true);
    const result = await saveRecommendationPreset({ name: presetName, tune });
    setSaving(false);
    if (!result.success) { toast.error(result.error ?? "Failed to save preset"); return; }
    toast.success("Preset saved");
  };
  const loadPreset = async () => {
    if (!selectedPresetId) return;
    setSaving(true);
    const result = await loadRecommendationPreset({ id: selectedPresetId });
    setSaving(false);
    if (!result.success) { toast.error(result.error ?? "Failed to load preset"); return; }
    const parsed = tuneContextSchema.safeParse(normalizeTuneContext(result.data?.tune));
    if (!parsed.success) { toast.error("Preset contains an invalid tune"); return; }
    setTune(parsed.data);
    toast.success("Preset loaded for this tab");
  };
  const deletePreset = async () => {
    if (!selectedPresetId) return;
    setSaving(true);
    const result = await deleteRecommendationPreset({ id: selectedPresetId });
    setSaving(false);
    if (!result.success) { toast.error(result.error ?? "Failed to delete preset"); return; }
    toast.success("Preset deleted");
  };

  return (
    <section className="group/tune mb-4 rounded-lg border border-border bg-muted/20">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={`${engine.toLowerCase()}-tune-controls`} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div><p className="technical-label text-muted-foreground">Tune this run</p>{open && <h3 id={`${engine.toLowerCase()}-tune-heading`} className="mt-1 text-lg font-semibold">What kind of journey are you looking for?</h3>}</div>
        <CaretDownIcon aria-hidden className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id={`${engine.toLowerCase()}-tune-controls`} className="border-t border-border p-4">
        <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-xs text-muted-foreground">Time
          <Select value={tune.time ?? "ANY"} onValueChange={(value) => update("time", value === "ANY" ? null : value as TuneContext["time"])}><SelectTrigger aria-label="Time" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem>{TIME_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Play style
          <Select value={tune.playStyle ?? "ANY"} onValueChange={(value) => update("playStyle", value === "ANY" ? null : value as TuneContext["playStyle"])}><SelectTrigger aria-label="Play style" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem><SelectItem value="SOLO">Solo</SelectItem><SelectItem value="ONLINE">Online with others</SelectItem><SelectItem value="COUCH">Couch co-op</SelectItem></SelectContent></Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Familiarity
          <Select value={tune.familiarity ?? "BALANCED"} onValueChange={(value) => update("familiarity", value as TuneContext["familiarity"])}><SelectTrigger aria-label="Familiarity" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FAMILIAR">Familiar</SelectItem><SelectItem value="BALANCED">Balanced</SelectItem><SelectItem value="DIFFERENT">Different</SelectItem></SelectContent></Select>
        </label>
      </div>
      {engine === "PLAY_NEXT" && <label className="mt-4 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={tune.handheld === true} onChange={(event) => update("handheld", event.target.checked)} className="accent-foreground" />Handheld only<span className="text-xs text-muted-foreground">(strict)</span></label>}
      <details className="group/filters mt-4 border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><CaretDownIcon aria-hidden className="size-4 transition-transform group-open/filters:rotate-180" />More filters</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs text-muted-foreground">Experience<Select value={tune.experience ?? "ANY"} onValueChange={(value) => update("experience", value === "ANY" ? null : value as TuneContext["experience"])}><SelectTrigger aria-label="Experience" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem>{EXPERIENCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Sequel posture<Select value={tune.sequelPosture ?? "ANY"} onValueChange={(value) => update("sequelPosture", value === "ANY" ? null : value as TuneContext["sequelPosture"])}><SelectTrigger aria-label="Sequel posture" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem><SelectItem value="SEQUEL">Sequel</SelectItem><SelectItem value="STANDALONE">Standalone</SelectItem></SelectContent></Select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Era<Select value={tune.era ?? "ANY"} onValueChange={(value) => update("era", value === "ANY" ? null : value as TuneContext["era"])}><SelectTrigger aria-label="Era" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem>{ERA_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Maturity<Select value={tune.maturity ?? "ANY"} onValueChange={(value) => update("maturity", value === "ANY" ? null : value as TuneContext["maturity"])}><SelectTrigger aria-label="Maturity" className={selectClassName}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ANY">Any</SelectItem><SelectItem value="CASUAL">Casual</SelectItem><SelectItem value="MATURE">Mature</SelectItem></SelectContent></Select></label>
          <MultiValuePicker label="Genres" options={knownValues.genres} selected={tune.genres} onChange={(values) => update("genres", values)} />
          <MultiValuePicker label="IGDB tags" options={knownValues.tags} selected={tune.tags} onChange={(values) => update("tags", values)} />
          <MultiValuePicker label="Personal tags" options={knownValues.personalTags} selected={tune.personalTags ?? []} onChange={(values) => update("personalTags", values)} />
          {engine === "PLAY_NEXT" && <fieldset className="grid gap-2 text-xs text-muted-foreground md:col-span-2 xl:col-span-4"><legend>Sources</legend><div className="flex flex-wrap gap-x-4 gap-y-2"><label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sourceTune.steam} onChange={(event) => updateSourceTune("steam", event.target.checked)} className="accent-foreground" /><SourceIcon iconName="MonitorPlay" brandIcon="steam.svg" />Steam</label><label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sourceTune.rom} onChange={(event) => updateSourceTune("rom", event.target.checked)} className="accent-foreground" /><SourceIcon iconName="Disc3" />ROM</label><label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sourceTune.allAlternatives} onChange={(event) => updateSourceTune("allAlternatives", event.target.checked)} className="accent-foreground" /><SourceIcon iconName="Box" />Any alternative source</label>{alternativeSources.map((source) => <label key={source.id} className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sourceTune.alternativeSourceIds.includes(source.id)} onChange={(event) => toggleAlternativeSource(source.id, event.target.checked)} className="accent-foreground" /><SourceIcon iconName={source.iconName} brandIcon={source.brandIcon} />{source.name}</label>)}</div></fieldset>}
        </div>
      </details>
      <div className="mt-4 grid gap-2 border-t border-border pt-3"><span className="text-xs text-muted-foreground">Named presets</span><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" maxLength={100} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" aria-label="Preset name" /><button type="button" onClick={() => void savePreset()} disabled={saving} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Save preset</button><Select value={selectedPresetId || "NONE"} onValueChange={(value) => setSelectedPresetId(value === "NONE" ? "" : value)}><SelectTrigger aria-label="Saved presets" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Choose preset</SelectItem>{presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}</SelectContent></Select><button type="button" onClick={() => void loadPreset()} disabled={saving || !selectedPresetId} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Load preset</button><button type="button" onClick={() => void deletePreset()} disabled={saving || !selectedPresetId} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Delete preset</button></div><button type="button" onClick={reset} disabled={saving} className="rounded-md border border-border px-3 py-2 text-sm hover:text-foreground disabled:opacity-50">Reset</button></div></div>
      {thinPool && <p className="mt-3 text-xs text-muted-foreground">This tune matched fewer candidates than this engine displays, so other eligible items remain visible.</p>}
      </div>}
    </section>
  );
}
