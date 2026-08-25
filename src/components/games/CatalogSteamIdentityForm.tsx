"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { setCatalogSteamAppId } from "@/actions/catalog-identity";
import { parseSteamAppIdInput } from "@/lib/steam-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CatalogSteamIdentityForm({ gameId, gameName }: { gameId: string; gameName: string }) {
  const router = useRouter();
  const [identityInput, setIdentityInput] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = identityInput.trim() ? parseSteamAppIdInput(identityInput) : null;

  const save = async () => {
    setSaving(true);
    const result = await setCatalogSteamAppId({ gameId, identityInput });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save Steam identity");
      return;
    }
    toast.success(`Steam App ${result.data.externalId} linked to "${gameName}"`);
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-medium">Link Steam identity</h3>
        <p className="text-xs text-muted-foreground">
          Add a Steam store URL or bare App ID to enable compatibility evidence.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={identityInput}
          onChange={(event) => setIdentityInput(event.target.value)}
          placeholder="Steam store URL or App ID"
          aria-label={`Steam identity for ${gameName}`}
        />
        <Button type="button" onClick={() => void save()} disabled={saving || !parsed?.ok}>
          <Link2 aria-hidden />
          {saving ? "Saving..." : "Link Steam"}
        </Button>
      </div>
      {parsed && !parsed.ok && <p className="text-xs text-destructive">{parsed.reason}</p>}
      {parsed?.ok && <p className="text-xs text-muted-foreground">Will save App ID {parsed.appId}</p>}
    </div>
  );
}
