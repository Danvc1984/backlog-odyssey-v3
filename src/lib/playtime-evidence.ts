import { durationBand } from "@/lib/recommendations/profile";

export type DurationProfile = "HASTILY" | "NORMALLY" | "COMPLETELY";
export type PlaytimeProvider = "IGDB" | "STEAMSPY";

export interface PlaytimeEvidenceRow {
  provider: PlaytimeProvider | string;
  payload: unknown;
}

export interface DurationEstimate {
  hours: number;
  band: string;
  source: "IGDB_TIME_TO_BEATS" | "STEAMSPY_MEDIAN";
  sampleCount: number | null;
}

export interface DurationOption {
  profile: DurationProfile | null;
  label: string;
  estimate: DurationEstimate;
}

export function resolveWishlistDurationEstimate(
  value: unknown,
  profile: DurationProfile,
): DurationEstimate | null {
  if (!isRecord(value) || !isRecord(value.durationEvidence)) return null;
  const evidence = value.durationEvidence;
  if (evidence.provider !== "IGDB" && evidence.provider !== "STEAMSPY") return null;
  if (!("payload" in evidence)) return null;
  return resolveDurationEstimate(
    { provider: evidence.provider, payload: evidence.payload },
    profile,
  );
}

interface IgdbPayload {
  count: number | null;
  hastilySeconds: number | null;
  normallySeconds: number | null;
  completelySeconds: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function parseIgdbPayload(value: unknown): IgdbPayload | null {
  if (!isRecord(value)) return null;
  return {
    count: positiveNumber(value.count),
    hastilySeconds: positiveNumber(value.hastilySeconds),
    normallySeconds: positiveNumber(value.normallySeconds),
    completelySeconds: positiveNumber(value.completelySeconds),
  };
}

function parseSteamSpyMinutes(value: unknown): number | null {
  if (!isRecord(value)) return null;
  return positiveNumber(value.medianForeverMinutes);
}

function toEstimate(
  minutes: number,
  source: DurationEstimate["source"],
  sampleCount: number | null,
): DurationEstimate | null {
  const hours = minutes / 60;
  const band = durationBand(hours);
  return band === null ? null : { hours, band, source, sampleCount };
}

export function resolveDurationEstimate(
  row: PlaytimeEvidenceRow | null | undefined,
  profile: DurationProfile,
): DurationEstimate | null {
  if (!row) return null;
  if (row.provider === "STEAMSPY") {
    const minutes = parseSteamSpyMinutes(row.payload);
    return minutes === null ? null : toEstimate(minutes, "STEAMSPY_MEDIAN", null);
  }
  if (row.provider !== "IGDB") return null;

  const payload = parseIgdbPayload(row.payload);
  if (!payload) return null;
  const selectedKey = {
    HASTILY: "hastilySeconds",
    NORMALLY: "normallySeconds",
    COMPLETELY: "completelySeconds",
  }[profile] as keyof IgdbPayload;
  const seconds = [
    payload[selectedKey],
    payload.normallySeconds,
    payload.hastilySeconds,
    payload.completelySeconds,
  ].find((value): value is number => value !== null);
  return seconds === undefined
    ? null
    : toEstimate(seconds / 60, "IGDB_TIME_TO_BEATS", payload.count);
}

export function resolveDurationOptions(row: PlaytimeEvidenceRow | null | undefined): DurationOption[] {
  if (!row) return [];
  if (row.provider === "STEAMSPY") {
    const estimate = resolveDurationEstimate(row, "NORMALLY");
    return estimate ? [{ profile: null, label: "SteamSpy median", estimate }] : [];
  }
  if (row.provider !== "IGDB") return [];

  const payload = parseIgdbPayload(row.payload);
  if (!payload) return [];
  return ([
    ["HASTILY", "Main story", payload.hastilySeconds],
    ["NORMALLY", "Main + extras", payload.normallySeconds],
    ["COMPLETELY", "Completionist", payload.completelySeconds],
  ] as const).flatMap(([profile, label, seconds]) => {
    if (seconds === null) return [];
    const estimate = toEstimate(seconds / 60, "IGDB_TIME_TO_BEATS", payload.count);
    return estimate ? [{ profile, label, estimate }] : [];
  });
}
