"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DATA_STORAGE_KEY,
  MOTION_STORAGE_KEY,
  applyVisualAttributes,
  normalizeData,
  normalizeMotion,
  resolveVisualPreferences,
  type DataSetting,
  type MotionPreference,
  type MotionSetting,
} from "@/lib/visual-preferences";

export interface VisualPreferencesValue {
  motion: MotionSetting;
  resolvedMotion: MotionPreference;
  data: DataSetting;
  setMotion: (value: MotionSetting) => void;
  setData: (value: DataSetting) => void;
}

interface VisualPreferencesState {
  motion: MotionSetting;
  data: DataSetting;
}

const VisualPreferencesContext = createContext<VisualPreferencesValue>({
  motion: "system",
  resolvedMotion: "full",
  data: "system",
  setMotion: () => {},
  setData: () => {},
});

export function useVisualPreferences(): VisualPreferencesValue {
  return useContext(VisualPreferencesContext);
}

function readStoredPreferences(): VisualPreferencesState {
  if (typeof window === "undefined") return { motion: "system", data: "system" };
  try {
    return {
      motion: normalizeMotion(window.localStorage.getItem(MOTION_STORAGE_KEY)),
      data: normalizeData(window.localStorage.getItem(DATA_STORAGE_KEY)),
    };
  } catch {
    return { motion: "system", data: "system" };
  }
}

export function VisualPreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VisualPreferencesState>(readStoredPreferences);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const commit = useCallback((next: VisualPreferencesState) => {
    stateRef.current = next;
    setState(next);
    applyVisualAttributes(document.documentElement, next.motion, next.data);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === MOTION_STORAGE_KEY || event.key === DATA_STORAGE_KEY) {
        commit(readStoredPreferences());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

  const setMotion = useCallback(
    (value: MotionSetting) => {
      const next = { ...stateRef.current, motion: value };
      try {
        if (value === "system") window.localStorage.removeItem(MOTION_STORAGE_KEY);
        else window.localStorage.setItem(MOTION_STORAGE_KEY, value);
      } catch {
        /* storage unavailable */
      }
      commit(next);
    },
    [commit],
  );

  const setData = useCallback(
    (value: DataSetting) => {
      const next = { ...stateRef.current, data: value };
      try {
        if (value === "system") window.localStorage.removeItem(DATA_STORAGE_KEY);
        else window.localStorage.setItem(DATA_STORAGE_KEY, value);
      } catch {
        /* storage unavailable */
      }
      commit(next);
    },
    [commit],
  );

  const value = useMemo(
    () => ({
      motion: state.motion,
      resolvedMotion: resolveVisualPreferences(state.motion, state.data, {
        reducedMotion: systemReducedMotion,
        reducedData: false,
      }).motion,
      data: state.data,
      setMotion,
      setData,
    }),
    [state, setMotion, setData, systemReducedMotion],
  );

  return (
    <VisualPreferencesContext.Provider value={value}>{children}</VisualPreferencesContext.Provider>
  );
}
