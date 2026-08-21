const STEAM_APP_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?store\.steampowered\.com\/app\/(\d+)(?:[/?#]|$)/i;
const BARE_APP_ID_PATTERN = /^\d{1,10}$/;

export type SteamAppIdParseResult =
  | { ok: true; appId: string }
  | { ok: false; reason: string };

export function parseSteamAppIdInput(raw: string): SteamAppIdParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Paste a Steam store URL or App ID" };
  }

  const urlMatch = STEAM_APP_URL_PATTERN.exec(trimmed);
  const candidate = urlMatch ? urlMatch[1] : trimmed;

  if (!BARE_APP_ID_PATTERN.test(candidate)) {
    return {
      ok: false,
      reason: "Not a Steam App ID or a store.steampowered.com/app URL",
    };
  }

  const numeric = Number(candidate);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return { ok: false, reason: "Steam App ID must be a positive number" };
  }

  return { ok: true, appId: candidate };
}
