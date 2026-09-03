import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { buildSteamOpenIdUrl, createStateNonce } from "@/lib/steam-openid";

const DEFAULT_BASE_URL = "http://localhost:3500";
const STEAM_STATE_COOKIE = "steam-openid-state";

export async function GET() {
  await requireUser();

  const host = process.env.AUTH_URL || DEFAULT_BASE_URL;
  const state = createStateNonce();
  const callbackUrl = new URL(`${host}/api/steam/callback`);
  callbackUrl.searchParams.set("state", state);
  const response = NextResponse.redirect(
    buildSteamOpenIdUrl(callbackUrl.toString(), host),
  );
  response.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
