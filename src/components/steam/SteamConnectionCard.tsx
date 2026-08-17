"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { disconnectSteam } from "@/actions/steam";
import { Unplug } from "lucide-react";

export function SteamConnectionCard({
  connected,
  steamId64,
}: {
  connected: boolean;
  steamId64: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const status = searchParams.get("steam");
    if (status === "connected") {
      toast.success("Steam account linked");
    } else if (status === "error") {
      toast.error("Failed to link Steam account");
    }
    if (status) {
      router.replace("/settings");
    }
  }, [searchParams, router]);

  const handleDisconnect = async () => {
    setSubmitting(true);
    const result = await disconnectSteam();
    setSubmitting(false);

    if (result.success) {
      toast.success("Steam account disconnected");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to disconnect");
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Steam</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {connected
              ? `Linked to SteamID64 ${steamId64}`
              : "Link your Steam account to sync owned games and playtime."}
          </p>
        </div>
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={submitting}
          >
            <Unplug />
            {submitting ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <Link href="/api/steam/connect">
            <Button size="sm">Connect Steam</Button>
          </Link>
        )}
      </div>
    </div>
  );
}