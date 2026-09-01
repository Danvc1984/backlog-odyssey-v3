"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import type { DataSetting, MotionSetting } from "@/lib/visual-preferences";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  label: string;
}

function SegmentedControl<T extends string>({ value, options, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-input p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-card-alt text-signal-strong"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SettingRowProps {
  title: string;
  description: string;
  control: ReactNode;
}

function SettingRow({ title, description, control }: SettingRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}

const themeOptions: Option<string>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const motionOptions: Option<MotionSetting>[] = [
  { value: "system", label: "System" },
  { value: "reduced", label: "Reduced" },
  { value: "full", label: "Full" },
];

const dataOptions: Option<DataSetting>[] = [
  { value: "system", label: "System" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

let hydrationDone = false;
const hydrationListeners = new Set<() => void>();

function notifyHydrated() {
  hydrationDone = true;
  hydrationListeners.forEach((listener) => listener());
  hydrationListeners.clear();
}

function subscribeHydration(listener: () => void) {
  hydrationListeners.add(listener);
  return () => {
    hydrationListeners.delete(listener);
  };
}

function getHydrationSnapshot() {
  return hydrationDone;
}

function useHasHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrationSnapshot, () => false);
}

export function AppearanceSection() {
  const hasHydrated = useHasHydrated();
  const { theme, setTheme } = useTheme();
  const { motion, data, setMotion, setData } = useVisualPreferences();

  useEffect(() => {
    notifyHydrated();
  }, []);

  const themeValue = hasHydrated ? theme ?? "system" : "system";
  const motionValue: MotionSetting = hasHydrated ? motion : "system";
  const dataValue: DataSetting = hasHydrated ? data : "system";

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Appearance
      </h2>
      <div className="mt-4 grid gap-4">
        <SettingRow
          title="Theme"
          description="Match the operating system or pin a specific mode."
          control={
            <SegmentedControl value={themeValue} options={themeOptions} onChange={setTheme} label="Theme mode" />
          }
        />
        <SettingRow
          title="Reduced motion"
          description="Reduce animations and motion across the app."
          control={
            <SegmentedControl value={motionValue} options={motionOptions} onChange={setMotion} label="Motion preference" />
          }
        />
        <SettingRow
          title="Reduced data"
          description="Scale back data-heavy content such as art and imagery."
          control={
            <SegmentedControl value={dataValue} options={dataOptions} onChange={setData} label="Data preference" />
          }
        />
      </div>
    </section>
  );
}