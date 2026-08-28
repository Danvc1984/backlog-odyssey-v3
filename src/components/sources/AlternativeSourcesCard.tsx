"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { icons, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createAlternativeSource,
  renameAlternativeSource,
  setAlternativeSourceArchived,
} from "@/actions/sources";
import {
  FALLBACK_SOURCE_ICON,
  KNOWN_SOURCES,
  resolveSourcePresentation,
} from "@/lib/sources/known-sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AlternativeSourceListRow {
  id: string;
  name: string;
  knownKey: string | null;
  archivedAt: Date | null;
  _count: { availability: number };
}

interface AlternativeSourcesCardProps {
  sources: AlternativeSourceListRow[];
}

const iconMap = icons as Record<string, LucideIcon>;

function SourceIcon({ iconName }: { iconName: string }) {
  const Icon = iconMap[iconName] ?? iconMap[FALLBACK_SOURCE_ICON];
  return <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />;
}

export function AlternativeSourcesCard({ sources }: AlternativeSourcesCardProps) {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const missingKnownSources = KNOWN_SOURCES.filter(
    (known) => !sources.some((source) => source.knownKey === known.key),
  );

  const createSource = async (name: string, quietReuse: boolean) => {
    setBusy(true);
    try {
      const result = await createAlternativeSource({ name });
      if (!result.success) {
        toast.error(result.error ?? "Failed to create source");
        return;
      }
      if (!quietReuse || sources.some((source) => source.id !== result.data.id)) {
        toast.success(`Source "${result.data.name}" ready`);
      }
      setCreateName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const quickAdd = (name: string) => {
    setBusy(true);
    void createSource(name, true);
  };

  const startRename = (source: AlternativeSourceListRow) => {
    setRenamingId(source.id);
    setRenameValue(source.name);
  };

  const saveRename = async () => {
    if (!renamingId || busy) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const result = await renameAlternativeSource(renamingId, { name });
      if (!result.success) {
        toast.error(result.error ?? "Failed to rename source");
        return;
      }
      toast.success("Source renamed");
      setRenamingId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleArchived = async (source: AlternativeSourceListRow) => {
    if (busy) return;
    setBusy(true);
    try {
      const archived = !source.archivedAt;
      const result = await setAlternativeSourceArchived(source.id, { archived });
      if (!result.success) {
        toast.error(result.error ?? "Failed to update source");
        return;
      }
      toast.success(archived ? "Source archived" : "Source restored");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-6 rounded-lg border border-border p-4"
      aria-labelledby="alternative-sources-heading"
    >
      <div>
        <h2
          id="alternative-sources-heading"
          className="text-sm font-medium uppercase tracking-wider text-muted-foreground"
        >
          Alternative sources
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable stores behind Other platform availability rows. Archived
          sources keep their references but stop appearing in quick picks.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          New source
          <Input
            aria-label="New source name"
            className="mt-1 w-64"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createSource(createName, false);
            }}
            placeholder="Store name..."
          />
        </label>
        <Button
          type="button"
          disabled={busy || createName.trim() === ""}
          onClick={() => void createSource(createName, false)}
        >
          Add source
        </Button>
      </div>

      {missingKnownSources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick add:</span>
          {missingKnownSources.map((known) => {
            const presentation = resolveSourcePresentation(known.label);
            return (
              <Button
                key={known.key}
                type="button"
                variant="outline"
                size="xs"
                disabled={busy}
                onClick={() => quickAdd(known.label)}
              >
                <SourceIcon iconName={presentation.iconName} />
                {known.label}
              </Button>
            );
          })}
        </div>
      )}

      {sources.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No alternative sources yet. Anything stored under Other platform uses
          the Unspecified source.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {sources.map((source) => {
            const presentation = resolveSourcePresentation(source.name);
            const archived = source.archivedAt !== null;
            return (
              <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <SourceIcon iconName={presentation.iconName} />
                  {renamingId === source.id ? (
                    <Input
                      className="w-56"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveRename();
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate text-sm">{source.name}</span>
                  )}
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {source.knownKey ? "Known" : "Custom"}
                  </span>
                  {archived && (
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Archived
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{source._count.availability} in use</span>
                  {renamingId === source.id ? (
                    <>
                      <Button type="button" size="sm" disabled={busy} onClick={() => void saveRename()}>
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => startRename(source)}>
                      Rename
                    </Button>
                  )}
                  <Button type="button" size="sm" variant={archived ? "ghost" : "outline"} disabled={busy} onClick={() => void toggleArchived(source)}>
                    {archived ? "Restore" : "Archive"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}