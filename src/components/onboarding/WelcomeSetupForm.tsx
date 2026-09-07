"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { updateOsSetup } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OsSetup } from "@/lib/os-setup";

export function WelcomeSetupForm({ gameCount }: { gameCount: number }) {
  const [primaryOs, setPrimaryOs] = useState<OsSetup["primaryOs"]>("LINUX");
  const [hasWindowsFallback, setHasWindowsFallback] = useState(false);
  const [handheldOs, setHandheldOs] = useState<OsSetup["handheldOs"]>("NONE");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateOsSetup({ primaryOs, hasWindowsFallback, handheldOs, onboardingCompleted: true });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Could not save setup");
      return;
    }
    setCompleted(true);
    toast.success("Setup saved");
  };

  if (completed) {
    return (
      <div className="grid gap-4">
        <div className="rounded-lg border border-signal/30 bg-signal/10 p-4 text-sm">
          Your environment is ready. You can change it later in Settings.
        </div>
        {gameCount >= 5 ? (
          <div className="grid gap-3 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-medium">Set up your taste?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Answer a few questions to give recommendations a starting point.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/today#taste-setup">Start now</Link></Button>
              <Button asChild variant="outline"><Link href="/today">Not now</Link></Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Import or add games in your Library before setting up your taste.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/library">Go to Library</Link></Button>
              <Button asChild variant="outline"><Link href="/today">Continue to Today</Link></Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="welcome-primary-os">Primary OS</Label>
        <Select value={primaryOs} onValueChange={(value) => { const next = value as OsSetup["primaryOs"]; setPrimaryOs(next); if (next === "WINDOWS") setHasWindowsFallback(false); }}>
          <SelectTrigger id="welcome-primary-os"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LINUX">Linux</SelectItem>
            <SelectItem value="WINDOWS">Windows</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {primaryOs === "LINUX" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasWindowsFallback} onChange={(event) => setHasWindowsFallback(event.target.checked)} className="accent-foreground" />
          I have a Windows fallback
        </label>
      )}
      <div className="grid gap-2">
        <Label htmlFor="welcome-handheld-os">Handheld OS</Label>
        <Select value={handheldOs} onValueChange={(value) => setHandheldOs(value as OsSetup["handheldOs"])}>
          <SelectTrigger id="welcome-handheld-os"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">No handheld</SelectItem>
            <SelectItem value="LINUX">Linux</SelectItem>
            <SelectItem value="WINDOWS">Windows</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save setup"}</Button>
    </div>
  );
}
