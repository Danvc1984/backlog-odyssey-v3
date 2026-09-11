import type { IgdbMetadataPayload, IgdbNamedValue, IgdbRelation } from "@/lib/igdb-types";
import { externalUrl } from "@/lib/external-url";
import { SectionCard } from "@/components/ui/detail-card";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}

function Values({ label, values }: { label: string; values: readonly string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => <span key={value} className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs">{value}</span>)}
      </dd>
    </div>
  );
}

function NamedValues({ label, values }: { label: string; values: readonly IgdbNamedValue[] }) {
  return <Values label={label} values={values.map((value) => value.name)} />;
}

function Rating({ label, score, count }: { label: string; score: number | null; count: number | null }) {
  if (score === null && count === null) return null;
  return <Field label={label} value={`${score === null ? "No score" : `${score.toFixed(1)} / 100`}${count === null ? "" : ` (${count.toLocaleString()} ratings)`}`} />;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Relations({ relations }: { relations: readonly IgdbRelation[] }) {
  const grouped = relations.reduce<Map<string, string[]>>((groups, relation) => {
    const values = groups.get(relation.kind) ?? [];
    values.push(relation.name);
    groups.set(relation.kind, values);
    return groups;
  }, new Map());

  return [...grouped.entries()].map(([kind, values]) => <Values key={kind} label={kind} values={values} />);
}

export function MetadataSection({
  payload,
  sourceUrl,
  fetchedAt,
}: {
  payload: IgdbMetadataPayload | null;
  sourceUrl: string | null;
  fetchedAt: Date | null;
}) {
  const source = externalUrl(sourceUrl ?? payload?.attribution.sourceUrl ?? null);
  const website = externalUrl(payload?.officialWebsite ?? null);

  return (
    <SectionCard eyebrow="Metadata" title="Game details" id="igdb-metadata-heading">
      {!payload ? (
        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium">No metadata yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Metadata will appear here after this game is matched.</p>
        </div>
      ) : (
        <div className="space-y-5 rounded-lg border border-border p-4">
          {payload.summary && <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{payload.summary}</p>}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="First released" value={formatDate(payload.firstReleaseDate)} />
            <NamedValues label="Genres" values={payload.genres} />
            <NamedValues label="Developers" values={payload.developers} />
            <NamedValues label="Publishers" values={payload.publishers} />
            <Field label="ESRB" value={payload.esrbRating} />
          </dl>

          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-semibold">More details</summary>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NamedValues label="Themes" values={payload.themes} />
              <NamedValues label="Keywords" values={payload.keywords} />
              <Field label="Official website" value={payload.officialWebsite} />
              <Rating label="IGDB aggregated rating" {...payload.ratings.aggregated} />
              <Rating label="IGDB community rating" {...payload.ratings.community} />
              <Rating label="IGDB total rating" {...payload.ratings.total} />
              <NamedValues label="Collection" values={payload.collection ? [payload.collection] : []} />
              <NamedValues label="Franchise" values={payload.franchise ? [payload.franchise] : []} />
              <Values label="Game modes" values={payload.gameModes} />
              <Values label="Multiplayer modes" values={payload.multiplayerModes} />
              <Relations relations={payload.relations} />
            </dl>
          </details>

          <div className="flex flex-col gap-3 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            {website && <a href={website} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">Visit official website</a>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
              <span>Last updated{fetchedAt ? ` ${fetchedAt.toLocaleDateString("en-US")}` : ""}.</span>
              {source ? <a href={source} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline"><span className="inline-flex items-center gap-1">IGDB <ArrowSquareOutIcon aria-hidden="true" className="size-3" /></span></a> : <span>Source link unavailable.</span>}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
