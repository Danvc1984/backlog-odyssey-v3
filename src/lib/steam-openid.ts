import { randomBytes, timingSafeEqual } from "node:crypto";

const OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

export function createStateNonce(): string {
  return randomBytes(32).toString("hex");
}

export function statesMatch(
  expectedState: string | null | undefined,
  receivedState: string | null | undefined,
): boolean {
  if (!expectedState || !receivedState) return false;

  const expected = Buffer.from(expectedState);
  const received = Buffer.from(receivedState);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function buildSteamOpenIdUrl(returnUrl: string, realm: string): string {
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnUrl,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${OPENID_ENDPOINT}?${params.toString()}`;
}

export function extractSteamId64(
  query: Record<string, string>,
): string | null {
  const claimedId = query["openid.claimed_id"];
  if (!claimedId) return null;
  const match = claimedId.match(/\/openid\/id\/(\d+)\/?$/);
  return match ? match[1] : null;
}

export async function verifySteamOpenIdResponse(
  query: Record<string, string>,
): Promise<boolean> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("openid.")) {
      params.set(key, value);
    }
  }
  params.set("openid.mode", "check_authentication");

  try {
    const response = await fetch(OPENID_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });
    if (!response.ok) return false;

    const text = await response.text();
    const fields = new Map(
      text.split(/\r?\n/).flatMap((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex < 0) return [];

        return [[
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim(),
        ] as const];
      }),
    );
    return fields.get("is_valid") === "true";
  } catch {
    return false;
  }
}
