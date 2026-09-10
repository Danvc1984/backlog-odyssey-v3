"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SignOutIcon } from "@phosphor-icons/react";
import { updateOsSetup } from "@/actions/settings";
import { buildOsSetupConsequenceSummary, type OsSetup } from "@/lib/os-setup";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";

const DEFAULT_SETUP: OsSetup = {
  primaryOs: "LINUX",
  hasWindowsFallback: false,
  handheldOs: "NONE",
  onboardingCompleted: false,
};

const ENVIRONMENT_LABELS = {
  LINUX: "Linux",
  WINDOWS: "Windows",
  NONE: "None",
} as const;

interface EnvironmentSettings extends OsSetup {
  priceCountry: string | null;
  timeZone: string | null;
}

function setupFromSettings(settings: EnvironmentSettings | null): OsSetup {
  if (!settings) return DEFAULT_SETUP;
  return {
    primaryOs: settings.primaryOs,
    hasWindowsFallback: settings.hasWindowsFallback,
    handheldOs: settings.handheldOs,
    onboardingCompleted: settings.onboardingCompleted,
  };
}

function environmentLabel(value: keyof typeof ENVIRONMENT_LABELS | string | null): string {
  return value ? ENVIRONMENT_LABELS[value as keyof typeof ENVIRONMENT_LABELS] ?? value : "Not set";
}

export function AccountCard({
  email,
  signOutAction,
  settings,
}: {
  email: string | null;
  signOutAction: () => Promise<void>;
  settings: EnvironmentSettings | null;
}) {
  const [savedSetup, setSavedSetup] = useState(() => setupFromSettings(settings));
  const [draft, setDraft] = useState(savedSetup);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const consequence = buildOsSetupConsequenceSummary(draft);

  const rows = [
    { label: "Primary OS", value: environmentLabel(savedSetup.primaryOs) },
    { label: "Windows fallback", value: savedSetup.hasWindowsFallback ? "Yes" : "No" },
    { label: "Handheld OS", value: environmentLabel(savedSetup.handheldOs) },
    { label: "Price country", value: settings?.priceCountry ?? "MX" },
    { label: "Time zone", value: settings?.timeZone ?? "America/Mexico_City" },
  ];

  const beginEdit = () => {
    setDraft(savedSetup);
    setConfirming(false);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const result = await updateOsSetup(draft);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to update OS setup");
      return;
    }
    setSavedSetup(draft);
    setOpen(false);
    setConfirming(false);
    toast.success("OS setup updated");
  };

  return (
    <SectionCard
      eyebrow="Account"
      title="Account"
      description="The Google session and device context this library runs for."
      status={<StatusPill tone="ok">Connected</StatusPill>}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Google session</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The Google account signed into this app instance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {email ? (
                <span className="font-medium">{email}</span>
              ) : (
                <span className="text-muted-foreground">Signed in</span>
              )}
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                <SignOutIcon aria-hidden className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Environment</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Context used for compatibility, prices, and scheduling.
              </p>
            </div>
            <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) { setDraft(savedSetup); setConfirming(false); } setOpen(nextOpen); }}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" onClick={beginEdit}>Edit</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                {!confirming ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Edit environment</DialogTitle>
                      <DialogDescription>Choose the devices this library is meant to support.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="primary-os">Primary OS</Label>
                        <Select value={draft.primaryOs} onValueChange={(value) => setDraft((current) => ({ ...current, primaryOs: value as OsSetup["primaryOs"], hasWindowsFallback: value === "WINDOWS" ? false : current.hasWindowsFallback }))}>
                          <SelectTrigger id="primary-os"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LINUX">Linux</SelectItem>
                            <SelectItem value="WINDOWS">Windows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {draft.primaryOs === "LINUX" && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={draft.hasWindowsFallback} onChange={(event) => setDraft((current) => ({ ...current, hasWindowsFallback: event.target.checked }))} className="accent-foreground" />
                          I have a Windows fallback
                        </label>
                      )}
                      <div className="grid gap-2">
                        <Label htmlFor="handheld-os">Handheld OS</Label>
                        <Select value={draft.handheldOs} onValueChange={(value) => setDraft((current) => ({ ...current, handheldOs: value as OsSetup["handheldOs"] }))}>
                          <SelectTrigger id="handheld-os"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">No handheld</SelectItem>
                            <SelectItem value="LINUX">Linux</SelectItem>
                            <SelectItem value="WINDOWS">Windows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="button" onClick={() => setConfirming(true)}>Review changes</Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Apply environment changes?</DialogTitle>
                      <DialogDescription>Saving this setup immediately updates derived compatibility and regenerates recommendation runs.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <p>{consequence.compatibility}</p>
                      <p>{consequence.recommendations}</p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Back</Button>
                      <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Confirm changes"}</Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
          <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SectionCard>
  );
}