export const MOTION_STORAGE_KEY = "backlog-odyssey:motion";
export const DATA_STORAGE_KEY = "backlog-odyssey:data";
export const MOTION_ATTRIBUTE = "data-motion";
export const REDUCED_DATA_ATTRIBUTE = "data-reduced-data";

export type MotionPreference = "full" | "reduced";
export type MotionSetting = MotionPreference | "system";
export type DataPreference = "on" | "off";
export type DataSetting = DataPreference | "system";

export interface SystemVisualPreferences {
  reducedMotion: boolean;
  reducedData: boolean;
}

export interface ResolvedVisualPreferences {
  motion: MotionPreference;
  data: DataPreference;
}

export interface AttributeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export function normalizeMotion(raw: unknown): MotionSetting {
  return raw === "full" || raw === "reduced" ? raw : "system";
}

export function normalizeData(raw: unknown): DataSetting {
  return raw === "on" || raw === "off" ? raw : "system";
}

export function resolveVisualPreferences(
  motion: MotionSetting,
  data: DataSetting,
  system: SystemVisualPreferences,
): ResolvedVisualPreferences {
  return {
    motion: motion === "system" ? (system.reducedMotion ? "reduced" : "full") : motion,
    data: data === "system" ? (system.reducedData ? "on" : "off") : data,
  };
}

export function applyVisualAttributes(
  target: AttributeTarget,
  motion: MotionSetting,
  data: DataSetting,
): void {
  if (motion === "system") target.removeAttribute(MOTION_ATTRIBUTE);
  else target.setAttribute(MOTION_ATTRIBUTE, motion);
  if (data === "system") target.removeAttribute(REDUCED_DATA_ATTRIBUTE);
  else target.setAttribute(REDUCED_DATA_ATTRIBUTE, data);
}