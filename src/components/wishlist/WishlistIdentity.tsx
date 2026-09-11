"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkSimpleIcon, XIcon } from "@phosphor-icons/react";
import {
  removeWishlistIdentity,
  setWishlistIdentity,
} from "@/actions/wishlist-identity";
import { parseSteamAppIdInput } from "@/lib/steam-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVENANCE_LABELS: Record<string, string> = {
  STEAM_IMPORT: "from Steam import",
  USER: "added by you",
  IGDB_SUGGESTION: "from IGDB",
};

interface WishlistIdentityProps {
  entryId: string;
  entryName: string;
  steamAppId: string | null;
  provenance: string | null;
}

export function WishlistIdentity({
  entryId,
  entryName,
  steamAppId,
  provenance,
}: WishlistIdentityProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = rawInput.trim() ? parseSteamAppIdInput(rawInput) : null;
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
          <LinkSimpleIcon className="h-3 w-3" aria-hidden />
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
          <XIcon />
        </Button>
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
          <LinkSimpleIcon aria-hidden /> Add Steam link
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
