"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, X } from "lucide-react";
import {
  confirmRawgSuggestedIdentity,
  dismissRawgIdentitySuggestion,
  removeWishlistIdentity,
  setWishlistIdentity,
} from "@/actions/wishlist-identity";
import { parseSteamAppIdInput } from "@/lib/steam-identity";
import { wishlistIdentitySuggestion } from "@/lib/wishlist-identity-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVENANCE_LABELS: Record<string, string> = {
  STEAM_IMPORT: "from Steam import",
  USER: "added by you",
  RAWG_SUGGESTION: "from RAWG",
};

interface WishlistIdentityProps {
  entryId: string;
  entryName: string;
  steamAppId: string | null;
  provenance: string | null;
  snapshot: { payload: unknown; fetchedAt: Date } | null;
}

export function WishlistIdentity({
  entryId,
  entryName,
  steamAppId,
  provenance,
  snapshot,
}: WishlistIdentityProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = rawInput.trim() ? parseSteamAppIdInput(rawInput) : null;
  const { suggestion, dismissed } = wishlistIdentitySuggestion(
    { steamAppId, steamAppIdProvenance: provenance },
    snapshot,
  );

  const confirm = async () => {
    setSaving(true);
    const result = await setWishlistIdentity({
      wishlistEntryId: entryId,
      identityInput: rawInput,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save Steam identity");
      return;
    }
    setAdding(false);
    setRawInput("");
    toast.success(`Steam identity saved on "${entryName}"`);
    router.refresh();
  };

  const remove = async () => {
    setSaving(true);
    const result = await removeWishlistIdentity({ wishlistEntryId: entryId });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to remove Steam identity");
      return;
    }
    toast.success(`Steam identity removed from "${entryName}"`);
    router.refresh();
  };

  if (steamAppId) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3" aria-hidden />
          Steam App {steamAppId}
          {provenance && PROVENANCE_LABELS[provenance] ? ` · ${PROVENANCE_LABELS[provenance]}` : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={saving}
          onClick={() => void remove()}
          aria-label={`Remove Steam identity from ${entryName}`}
        >
          <X />
        </Button>
      </div>
    );
  }

  const confirmSuggestion = async () => {
    setSaving(true);
    const result = await confirmRawgSuggestedIdentity({ wishlistEntryId: entryId });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to confirm the suggested identity");
      return;
    }
    toast.success(`Steam App ${suggestion?.steamAppId} confirmed on "${entryName}"`);
    router.refresh();
  };

  const dismissSuggestion = async () => {
    setSaving(true);
    const result = await dismissRawgIdentitySuggestion({ wishlistEntryId: entryId });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to dismiss the suggestion");
      return;
    }
    toast.success("Suggestion dismissed. It will reappear after the next RAWG refresh.");
    router.refresh();
  };

  if (suggestion && !dismissed) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">
          RAWG suggests{" "}
          <a href={suggestion.steamUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Steam App {suggestion.steamAppId}
          </a>{" "}
          for this entry.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void confirmSuggestion()} disabled={saving}>
            {saving ? "Saving..." : "Confirm"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void dismissSuggestion()} disabled={saving}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (!adding) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">No store identity - prices unavailable</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          className="text-xs text-muted-foreground"
        >
          <Link2 aria-hidden /> Add Steam link
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border p-2">
      <Input
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        placeholder="Steam store URL or App ID"
        aria-label={`Steam store URL or App ID for ${entryName}`}
        autoFocus
      />
      {parsed && !parsed.ok && <p className="text-xs text-destructive">{parsed.reason}</p>}
      {parsed?.ok && <p className="text-xs text-muted-foreground">Will save App ID {parsed.appId}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setAdding(false);
            setRawInput("");
          }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void confirm()}
          disabled={saving || !parsed?.ok}
        >
          {saving ? "Saving..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
