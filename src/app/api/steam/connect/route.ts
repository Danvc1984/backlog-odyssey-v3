import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { buildSteamOpenIdUrl } from "@/lib/steam-openid";

const DEFAULT_BASE_URL = "http://localhost:3500";

export async function GET() {
  await requireUser();

  const host = process.env.AUTH_URL || DEFAULT_BASE_URL;
  redirect(buildSteamOpenIdUrl(`${host}/api/steam/callback`, host));
}