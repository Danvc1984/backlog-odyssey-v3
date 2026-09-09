"use server";

import { requireUser } from "@/lib/auth-guard";
import {
  refreshSteamActivityCacheNow,
  type SteamActivityView,
} from "@/lib/steam-activity";

export async function refreshSteamActivityNow(): Promise<SteamActivityView> {
  await requireUser();
  return refreshSteamActivityCacheNow();
}
