import "server-only";

export interface ItadConfig {
  apiKey: string;
}

export type ItadConfigResult =
  | { ok: true; config: ItadConfig }
  | { ok: false; error: string };

export function getItadConfig(): ItadConfigResult {
  const apiKey = process.env.ITAD_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      ok: false,
      error: "ITAD is not configured: set ITAD_API_KEY in the environment",
    };
  }
  return { ok: true, config: { apiKey: apiKey.trim() } };
}
