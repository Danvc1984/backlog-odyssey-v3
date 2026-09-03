import type { WishlistStoreLink } from "./rawg-types";

export interface WishlistSuggestionInput {
  steamAppId: string | null;
  steamAppIdProvenance: string | null;
}

export interface WishlistSnapshotInput {
  storeLink: WishlistStoreLink;
  storeLinkDismissedAt: number | null;
  fetchedAt: Date | string;
}

export interface WishlistIdentitySuggestionView {
  suggestion: WishlistStoreLink | null;
  dismissed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function identityConflictMessage(appId: string, conflictingName: string): string {
  return `Steam App ID ${appId} is already on "${conflictingName}"`;
}

export function storeLinkFromSnapshotPayload(payload: unknown): WishlistStoreLink | null {
  if (!isRecord(payload) || !isRecord(payload.storeLink)) {
    return null;
  }
  const { steamUrl, steamAppId } = payload.storeLink;
  if (
    typeof steamUrl !== "string" ||
    typeof steamAppId !== "string" ||
    !/^\d{1,10}$/.test(steamAppId)
  ) {
    return null;
  }
  return { steamUrl, steamAppId };
}

function dismissedAtFromSnapshotPayload(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null;
  }
  const raw = payload.storeLinkDismissedAt;
  if (typeof raw !== "string") {
    return null;
  }
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

export function wishlistIdentitySnapshotView(
  payload: unknown,
): Omit<WishlistSnapshotInput, "fetchedAt"> | null {
  const storeLink = storeLinkFromSnapshotPayload(payload);
  if (!storeLink) return null;

  return {
    storeLink,
    storeLinkDismissedAt: dismissedAtFromSnapshotPayload(payload),
  };
}

export function wishlistIdentitySuggestion(
  entry: WishlistSuggestionInput,
  snapshot: WishlistSnapshotInput | null,
): WishlistIdentitySuggestionView {
  if (entry.steamAppId !== null && entry.steamAppIdProvenance !== null) {
    return { suggestion: null, dismissed: false };
  }
  if (!snapshot) {
    return { suggestion: null, dismissed: false };
  }

  const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
  const dismissed =
    snapshot.storeLinkDismissedAt !== null &&
    !Number.isNaN(fetchedAtMs) &&
    snapshot.storeLinkDismissedAt > fetchedAtMs;

  return { suggestion: snapshot.storeLink, dismissed };
}
