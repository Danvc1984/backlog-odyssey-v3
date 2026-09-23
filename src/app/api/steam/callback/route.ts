import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  extractSteamId64,
  resolveSteamReturnIntent,
  statesMatch,
  steamReturnPath,
  type SteamReturnIntent,
  verifySteamOpenIdResponse,
} from "@/lib/steam-openid";

const STEAM_STATE_COOKIE = "steam-openid-state";
const STEAM_RETURN_INTENT_COOKIE = "steam-openid-return-intent";

export async function GET(req: Request) {
  const url = new URL(req.url);
  let returnIntent: SteamReturnIntent = "settings";

  try {
    await requireUser();

    const query = Object.fromEntries(url.searchParams.entries());
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get(STEAM_STATE_COOKIE)?.value;
    returnIntent = resolveSteamReturnIntent(
      cookieStore.get(STEAM_RETURN_INTENT_COOKIE)?.value,
    );
    const stateMatches = statesMatch(stateCookie, query.state);

    const expectedCallback = new URL(
      `${url.origin}/api/steam/callback`,
    );
    expectedCallback.searchParams.set("state", query.state ?? "");
    if (!stateMatches) {
      return errorRedirect(url, returnIntent);
    }

    if (query["openid.mode"] === "cancel") {
      if (
        query["openid.return_to"] &&
        query["openid.return_to"] !== expectedCallback.toString()
      ) {
        return errorRedirect(url, returnIntent);
      }
      return callbackRedirect(url, returnIntent, "cancelled");
    }

    if (query["openid.return_to"] !== expectedCallback.toString()) {
      return errorRedirect(url, returnIntent);
    }

    const verified = await verifySteamOpenIdResponse(query);
    const steamId64 = extractSteamId64(query);

    if (!verified || !steamId64) {
      return errorRedirect(url, returnIntent);
    }

    await prisma.steamConnection.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        steamId64,
        state: "CONNECTED",
      },
      update: {
        steamId64,
        state: "CONNECTED",
      },
    });

    return callbackRedirect(url, returnIntent, "connected");
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("steam callback error:", err);
    return errorRedirect(url, returnIntent);
  }
}

function errorRedirect(
  url: URL,
  returnIntent: SteamReturnIntent = "settings",
): NextResponse {
  const response = NextResponse.redirect(
    new URL(steamReturnPath(returnIntent, "error"), url.origin),
  );
  response.cookies.delete(STEAM_STATE_COOKIE);
  response.cookies.delete(STEAM_RETURN_INTENT_COOKIE);
  return response;
}

function callbackRedirect(
  url: URL,
  returnIntent: SteamReturnIntent,
  status: "connected" | "cancelled",
): NextResponse {
  const response = NextResponse.redirect(
    new URL(steamReturnPath(returnIntent, status), url.origin),
  );
  response.cookies.delete(STEAM_STATE_COOKIE);
  response.cookies.delete(STEAM_RETURN_INTENT_COOKIE);
  return response;
}
