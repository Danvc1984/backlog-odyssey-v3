"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircleIcon, SparkleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acquireWishlistBaseGame, acquireWishlistDlc } from "@/actions/wishlist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVisualPreferences } from "@/components/preferences/VisualPreferencesProvider";
import { SourceIcon } from "@/components/sources/SourceIcon";
import type { WishlistOfferView } from "@/types/wishlist-offers";

type AcquisitionSource = "STEAM" | "OTHER_PLATFORM";
type SourceValue = "STEAM" | `ALT:${string}`;

type AlternativeSource = {
  id: string;
  name: string;
  iconName: string;
  brandIcon?: string;
};
type ParentPlayState = "NOT_STARTED" | "IN_PROGRESS" | "PLAN_TO_PLAY";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatOfferPrice(offer: WishlistOfferView): string {
  if (offer.price === null) return "Price unavailable";
  return `${offer.currency?.trim().toUpperCase() ?? "Unknown currency"} ${priceFormatter.format(offer.price)}`;
}

export function AcquireWishlistDialog({
  entry,
  imageUrl,
  selectedOffer = null,
  alternativeSources = [],
}: {
  entry: { id: string; name: string; type: string };
  imageUrl?: string | null;
  selectedOffer?: WishlistOfferView | null;
  alternativeSources?: AlternativeSource[];
}) {
  const router = useRouter();
  const { resolvedMotion, resolvedData } = useVisualPreferences();
  const defaultSource = (): SourceValue => "STEAM";
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SourceValue>(defaultSource);
  const [parentPlayState, setParentPlayState] = useState<ParentPlayState | "NONE">("NONE");
  const [parentReplay, setParentReplay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const reset = () => {
    setSource(defaultSource());
    setParentPlayState("NONE");
    setParentReplay(false);
    setError(null);
    setCompleted(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const acquisitionSource: AcquisitionSource = source.startsWith("ALT:")
      ? "OTHER_PLATFORM"
      : source as AcquisitionSource;
    const alternativeSourceId = source.startsWith("ALT:") ? source.slice(4) : undefined;
    const result = entry.type === "DLC"
      ? await acquireWishlistDlc({
          wishlistEntryId: entry.id,
          source: acquisitionSource,
          ...(alternativeSourceId && { alternativeSourceId }),
          ...(parentPlayState !== "NONE" && { updateParentPlayState: parentPlayState }),
          setParentReplay: parentReplay,
        })
      : await acquireWishlistBaseGame({
          wishlistEntryId: entry.id,
          source: acquisitionSource,
          ...(alternativeSourceId && { alternativeSourceId }),
        });

    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to acquire wishlist entry");
      return;
    }

    toast.success(`Acquired "${entry.name}"`);
    setCompleted(true);
  };

  const selectedAlternativeSource = source.startsWith("ALT:")
    ? alternativeSources.find((alternative) => alternative.id === source.slice(4))
    : null;
  const selectedSourcePresentation = selectedAlternativeSource ?? {
    iconName: "MonitorPlay",
    brandIcon: "steam.svg",
    name: "Steam",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          if (completed) router.refresh();
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="lg">Acquire</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {completed ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-300">
                <CheckCircleIcon weight="fill" aria-hidden="true" />
                Added to your catalog
              </DialogTitle>
              <DialogDescription>
                {entry.name} is no longer on your wishlist.
              </DialogDescription>
            </DialogHeader>
            <div className={`flex items-center gap-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 ${resolvedMotion === "full" ? "animate-in zoom-in-95" : ""}`}>
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/15">
                {imageUrl && resolvedData === "off" ? (
                  <Image
                    src={imageUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="px-2 text-center text-xs font-semibold text-muted-foreground">
                    {entry.name}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold">{entry.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">Your catalog is ready for the next step.</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SourceIcon iconName={selectedSourcePresentation.iconName} brandIcon={selectedSourcePresentation.brandIcon} />
                  Acquired through {selectedSourcePresentation.name}
                </p>
                {resolvedMotion === "full" && <SparkleIcon className="mt-3 size-5 text-amber-300" aria-hidden="true" />}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Make it part of your catalog</DialogTitle>
              <DialogDescription>
                Record how you acquired {entry.name}. This moves it from your wishlist into your catalog.
              </DialogDescription>
            </DialogHeader>
            <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card to-opportunity/10 p-4 shadow-card">
              <div className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
              <div className="relative flex items-center gap-4">
                <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-card/70 shadow-lg">
                  {imageUrl && resolvedData === "off" ? (
                    <Image src={imageUrl} alt="" fill sizes="112px" className="object-cover" unoptimized />
                  ) : (
                    <span className="px-3 text-center text-xs font-semibold text-muted-foreground">{entry.name}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ready to acquire</p>
                  <h3 className="mt-1 text-lg font-bold leading-tight">{entry.name}</h3>
                  {selectedOffer ? (
                    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-2xl font-bold text-emerald-300">{formatOfferPrice(selectedOffer)}</span>
                      {selectedOffer.discount !== null && selectedOffer.discount > 0 && (
                        <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-xs font-bold text-emerald-300">-{selectedOffer.discount}%</span>
                      )}
                      <span className="w-full text-xs text-muted-foreground">Main offer from {selectedOffer.shop}</span>
                      {selectedOffer.isEstimated && <span className="w-full text-xs text-muted-foreground">Estimated display value</span>}
                      {selectedOffer.conversionUnavailable && <span className="w-full text-xs text-muted-foreground">Display conversion unavailable; source price shown</span>}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No current offer is available.</p>
                  )}
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-5">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
                <Label htmlFor={`acquire-source-${entry.id}`}>Where did you acquire it?</Label>
                <p className="text-xs text-muted-foreground">This source becomes the platform label in your catalog.</p>
                <Select value={source} onValueChange={(value) => setSource(value as SourceValue)}>
                  <SelectTrigger id={`acquire-source-${entry.id}`} aria-label="Acquisition source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STEAM"><span className="flex items-center gap-2"><SourceIcon iconName="MonitorPlay" brandIcon="steam.svg" />Steam</span></SelectItem>
                    {alternativeSources.map((alternative) => (
                      <SelectItem key={alternative.id} value={`ALT:${alternative.id}`}>
                        <span className="flex items-center gap-2"><SourceIcon iconName={alternative.iconName} brandIcon={alternative.brandIcon} />{alternative.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {alternativeSources.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Need another source? Create an active reusable source in{" "}
                    <Link href="/settings#alternative-sources-heading" className="underline underline-offset-2">
                      Settings
                    </Link>.
                  </p>
                )}
              </div>

              {entry.type === "DLC" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor={`acquire-parent-state-${entry.id}`}>Parent play state (optional)</Label>
                    <Select value={parentPlayState} onValueChange={(value) => setParentPlayState(value as ParentPlayState | "NONE")}>
                      <SelectTrigger id={`acquire-parent-state-${entry.id}`} aria-label="Parent play state">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">No change</SelectItem>
                        <SelectItem value="NOT_STARTED">Not started</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="PLAN_TO_PLAY">Plan to play</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={parentReplay}
                      onChange={(event) => setParentReplay(event.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    Mark parent as replay candidate
                  </label>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Acquiring..." : "Confirm acquisition"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
