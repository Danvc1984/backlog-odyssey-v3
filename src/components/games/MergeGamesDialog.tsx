"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { executeMerge, proposeMerge } from "@/actions/catalog-operations";
import type { MergeProposal, PersonalFieldName } from "@/lib/catalog-operations";
import { showCatalogOperationToast, useUndoOperation } from "./CatalogOperationToast";

type SideChoice = { side: "a" | "b" };

const PERSONAL_FIELD_LABELS: Record<PersonalFieldName, string> = {
  playState: "Play state",
  isMainGame: "Main game",
  priority: "Priority",
  interest: "Interest",
  rating: "Rating",
  preferredEnvironment: "Preferred environment",
  compatOverrideStatus: "Compatibility override status",
  compatOverrideReason: "Compatibility override reason",
  playSoon: "Play soon",
  replayCandidate: "Replay candidate",
  hidden: "Hidden",
  notes: "Notes",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return String(value).toLowerCase().replace(/_/g, " ");
}

function personalSide(
  choice: SideChoice | { value: unknown } | undefined,
): "a" | "b" | undefined {
  return choice && "side" in choice ? choice.side : undefined;
}

function ChoiceButton({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-11 flex-1 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm ${
        selected
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30"
      }`}
    >
      <span className="font-medium">{label}</span>
      {detail && <span className="text-xs">{detail}</span>}
    </button>
  );
}

export function MergeGamesDialog({ duplicateId }: { duplicateId: string }) {
  const router = useRouter();
  const undo = useUndoOperation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MergeProposal | null>(null);
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [finalName, setFinalName] = useState("");
  const [personalChoices, setPersonalChoices] = useState<
    Record<string, SideChoice | { value: unknown }>
  >({});
  const [externalChoices, setExternalChoices] = useState<
    Record<string, { rowId: string }>
  >({});
  const [oneToOneChoices, setOneToOneChoices] = useState<
    Record<string, SideChoice>
  >({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await proposeMerge({ duplicateId });
    setLoading(false);
    if (result.success) {
      setProposal(result.data);
      setSurvivorId(result.data.survivorId);
      setFinalName(result.data.finalName);
      setPersonalChoices({});
      setExternalChoices({});
      setOneToOneChoices({});
      setConfirming(false);
      setSubmitError(null);
    } else {
      setLoadError(result.error ?? "Failed to load merge proposal");
    }
  }, [duplicateId]);

  const allConflictsResolved = useMemo(() => {
    if (!proposal) return false;
    const personalDone = proposal.library.conflicts.every(
      (conflict) => personalChoices[conflict.field],
    );
    const externalDone = proposal.externalIds.conflicts.every(
      (conflict) => externalChoices[conflict.namespace],
    );
    const oneToOneDone = proposal.oneToOne.every(
      (conflict) => oneToOneChoices[conflict.key],
    );
    return personalDone && externalDone && oneToOneDone;
  }, [proposal, personalChoices, externalChoices, oneToOneChoices]);

  const chooseSurvivor = (gameId: string) => {
    setSurvivorId(gameId);
    const game = proposal?.games.find((candidate) => candidate.id === gameId);
    if (game) setFinalName(game.name);
  };

  const submitMerge = async () => {
    if (!proposal || !survivorId) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await executeMerge({
      duplicateId: proposal.duplicateId,
      survivorId,
      finalName,
      personal: personalChoices,
      externalIds: externalChoices,
      oneToOne: oneToOneChoices,
    });
    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error ?? "Failed to merge games");
      if (result.error?.includes("recent catalog operation")) {
        setConfirming(false);
      }
      return;
    }

    toast.success(`Merged into "${finalName}"`, {
      id: `merge-success-${result.data.operationId}`,
      duration: 5000,
    });
    showCatalogOperationToast(
      {
        operationId: result.data.operationId,
        expiresAt: new Date(result.data.expiresAt),
      },
      () => void undo(result.data.operationId),
    );
    setOpen(false);
    router.refresh();
  };

  const canConfirm = Boolean(proposal && survivorId && finalName.trim() && allConflictsResolved);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadProposal();
        else setProposal(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <GitMerge />
          Merge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate games</DialogTitle>
          <DialogDescription>
            Consolidate two base games into one. Changes can be undone for a short window.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading proposal...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {proposal && !confirming && (
          <div className="grid gap-5">
            <section className="grid gap-2">
              <Label>Survivor</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                {proposal.games.map((game) => (
                  <ChoiceButton
                    key={game.id}
                    label={game.name}
                    detail={`${game.origin === "STEAM_IMPORT" ? "Steam import" : "Manual"} - ${game.dlcCount} DLC`}
                    selected={survivorId === game.id}
                    onSelect={() => chooseSurvivor(game.id)}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-2">
              <Label htmlFor="final-name">Final name</Label>
              <Input
                id="final-name"
                value={finalName}
                onChange={(event) => setFinalName(event.target.value)}
              />
            </section>

            {proposal.library.conflicts.length > 0 && (
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">Personal differences</h3>
                {proposal.library.conflicts.map((conflict) => {
                  const valueA = formatValue(conflict.a.value);
                  const valueB = formatValue(conflict.b.value);
                  return (
                    <div key={conflict.field} className="grid gap-1.5">
                      <p className="text-sm font-medium">
                        {PERSONAL_FIELD_LABELS[conflict.field]}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup">
                        <ChoiceButton
                          label={valueA}
                          detail={`From ${proposal.games[0].name}`}
                          selected={personalSide(personalChoices[conflict.field]) === "a"}
                          onSelect={() =>
                            setPersonalChoices((prev) => ({
                              ...prev,
                              [conflict.field]: { side: "a" },
                            }))
                          }
                        />
                        <ChoiceButton
                          label={valueB}
                          detail={`From ${proposal.games[1].name}`}
                          selected={personalSide(personalChoices[conflict.field]) === "b"}
                          onSelect={() =>
                            setPersonalChoices((prev) => ({
                              ...prev,
                              [conflict.field]: { side: "b" },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {proposal.externalIds.conflicts.length > 0 && (
              <section className="grid gap-3">
                <h3 className="font-semibold">External ID conflicts</h3>
                {proposal.externalIds.conflicts.map((conflict) => (
                  <div key={conflict.namespace} className="grid gap-1.5">
                    <p className="text-sm font-medium">
                      {conflict.namespace} has two different IDs
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup">
                      {conflict.rows.map((row) => (
                        <ChoiceButton
                          key={row.id}
                          label={row.externalId}
                          detail={`From ${proposal.games.find((game) => game.id === row.gameId)?.name}`}
                          selected={externalChoices[conflict.namespace]?.rowId === row.id}
                          onSelect={() =>
                            setExternalChoices((prev) => ({
                              ...prev,
                              [conflict.namespace]: { rowId: row.id },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {proposal.oneToOne.length > 0 && (
              <section className="grid gap-3">
                <h3 className="font-semibold">One-to-one conflicts</h3>
                {proposal.oneToOne.map((conflict) => (
                  <div key={conflict.key} className="grid gap-1.5">
                    <p className="text-sm font-medium">
                      {conflict.kind === "wishlist"
                        ? "Wishlist entry"
                        : conflict.kind === "compatibility"
                          ? `Compatibility (${conflict.key})`
                          : `Environment compatibility (${conflict.key})`}{" "}
                      exists on both games
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup">
                      <ChoiceButton
                        label="Keep game A's"
                        detail={proposal.games[0].name}
                        selected={oneToOneChoices[conflict.key]?.side === "a"}
                        onSelect={() =>
                          setOneToOneChoices((prev) => ({
                            ...prev,
                            [conflict.key]: { side: "a" },
                          }))
                        }
                      />
                      <ChoiceButton
                        label="Keep game B's"
                        detail={proposal.games[1].name}
                        selected={oneToOneChoices[conflict.key]?.side === "b"}
                        onSelect={() =>
                          setOneToOneChoices((prev) => ({
                            ...prev,
                            [conflict.key]: { side: "b" },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="grid gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Relations and DLC</p>
              <p className="text-muted-foreground">
                {proposal.games.reduce((sum, game) => sum + game.dlcCount, 0)} DLC reassigned
                to the survivor
              </p>
              <p className="text-muted-foreground">
                {proposal.relations.availability} availability,{" "}
                {proposal.relations.collections} collections,{" "}
                {proposal.relations.tags} tags,{" "}
                {proposal.relations.metadataSnapshots} metadata snapshots
              </p>
            </section>

            {!allConflictsResolved && (
              <p className="text-sm text-muted-foreground">
                Resolve every difference before continuing. Changes are only applied on
                the next screen.
              </p>
            )}
          </div>
        )}

        {proposal && confirming && (
          <div className="grid gap-4">
            <div className="grid gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p>
                <span className="font-medium">Survivor:</span>{" "}
                {proposal.games.find((game) => game.id === survivorId)?.name}
              </p>
              <p>
                <span className="font-medium">Final name:</span> {finalName}
              </p>
              <p>
                <span className="font-medium">Discarded:</span>{" "}
                {proposal.games.find((game) => game.id !== survivorId)?.name}
              </p>
              <p className="text-muted-foreground">
                Its DLC moves to the survivor. Trainers and other owned content merge or
                move to the survivor.
              </p>
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          </div>
        )}

        {proposal && (
          <DialogFooter className="sm:justify-between">
            {confirming ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Back to editing
                </Button>
                <Button type="button" onClick={submitMerge} disabled={submitting}>
                  {submitting ? "Merging..." : "Confirm merge"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="ml-auto"
                disabled={!canConfirm}
                onClick={() => setConfirming(true)}
              >
                Continue to confirmation
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}