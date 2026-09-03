import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  extractSteamId64,
  statesMatch,
  verifySteamOpenIdResponse,
} from "@/lib/steam-openid";

const STEAM_STATE_COOKIE = "steam-openid-state";

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    await requireUser();

    const query = Object.fromEntries(url.searchParams.entries());
    const stateCookie = (await cookies()).get(STEAM_STATE_COOKIE)?.value;
    const stateMatches = statesMatch(stateCookie, query.state);

    const expectedCallback = new URL(
      `${url.origin}/api/steam/callback`,
    );
    expectedCallback.searchParams.set("state", query.state ?? "");
    if (
      !stateMatches ||
      query["openid.return_to"] !== expectedCallback.toString()
    ) {
      return errorRedirect(url);
    }

    const verified = await verifySteamOpenIdResponse(query);
    const steamId64 = extractSteamId64(query);

    if (!verified || !steamId64) {
      return errorRedirect(url);
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

    return successRedirect(url);
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
    return errorRedirect(url);
  }
}

function errorRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(
    new URL("/settings?steam=error", url.origin),
  );
  response.cookies.delete(STEAM_STATE_COOKIE);
  return response;
}

function successRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(
    new URL("/settings?steam=connected", url.origin),
  );
  response.cookies.delete(STEAM_STATE_COOKIE);
  return response;
}
