import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  extractSteamId64,
  verifySteamOpenIdResponse,
} from "@/lib/steam-openid";

export async function GET(req: Request) {
  try {
    await requireUser();

    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());

    const expectedCallback = `${url.origin}/api/steam/callback`;
    if (query["openid.return_to"] !== expectedCallback) {
      redirect("/settings?steam=error");
    }

    const verified = await verifySteamOpenIdResponse(query);
    const steamId64 = extractSteamId64(query);

    if (!verified || !steamId64) {
      redirect("/settings?steam=error");
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

    redirect("/settings?steam=connected");
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
    redirect("/settings?steam=error");
  }
}