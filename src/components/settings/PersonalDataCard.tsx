"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/detail-card";

async function postImport(file: File): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: file,
    });
    let payload: { success?: boolean; data?: Record<string, number> | null; error?: string | null } | null = null;
    try {
      payload = (await response.json()) as {
        success?: boolean;
        data?: Record<string, number> | null;
        error?: string | null;
      } | null;
    } catch {
      // non-JSON fallthrough
    }
    if (!response.ok) {
      if (payload?.error) return { ok: false, message: payload.error };
      return { ok: false, message: `Import failed with status ${response.status}` };
    }
    const counts = payload?.data ?? null;
    if (!counts) return { ok: true, message: "Import completed" };
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const domains = Object.values(counts).filter((value) => value > 0).length;
    return {
      ok: true,
      message: `${total} record${total === 1 ? "" : "s"} restored (${domains} domain${domains === 1 ? "" : "s"})`,
    };
  } catch {
    return { ok: false, message: "Could not reach the import endpoint" };
  }
}

export function PersonalDataCard({
  gameCount,
  wishlistCount,
  recommendationRunCount,
}: {
  gameCount: number;
  wishlistCount: number;
  recommendationRunCount: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Choose an export file first");
      return;
    }
    setPending(true);
    const result = await postImport(file);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <SectionCard
      eyebrow="Data"
      title="Personal data"
      description="Download your catalog, wishlist, and platform decisions as a JSON file, or restore them from one."
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Export</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Provider snapshots, offers, and run records are excluded.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{gameCount}</span> games ·{" "}
              <span className="font-medium text-foreground">{wishlistCount}</span> wishlist
              entries · <span className="font-medium text-foreground">{recommendationRunCount}</span>{" "}
              recommendation runs
            </p>
            <a href="/api/export" download>
              <Button type="button" variant="outline" size="sm">
                <DownloadSimpleIcon aria-hidden className="size-4" />
                Download export
              </Button>
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-medium">Import</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Restores only into an empty schema. Refuses while any catalog, wishlist, or recommendation data exists.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-input file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUpload}
              disabled={pending || !file}
            >
              <UploadSimpleIcon aria-hidden className="size-4" />
              {pending ? "Restoring..." : "Restore from file"}
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}