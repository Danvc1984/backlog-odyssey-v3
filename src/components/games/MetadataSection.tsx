import type { RawgMetadataPayload } from "@/lib/rawg-types";

function externalUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function Values({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs"
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function MetadataSection({
  payload,
  sourceUrl,
  fetchedAt,
}: {
  payload: RawgMetadataPayload | null;
  sourceUrl: string | null;
  fetchedAt: Date | null;
}) {
  const source = externalUrl(sourceUrl ?? payload?.rawgUrl ?? null);
  const website = externalUrl(payload?.website ?? null);

  return (
    <section aria-labelledby="rawg-metadata-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="rawg-metadata-heading"
          className="text-sm font-medium uppercase tracking-wider text-muted-foreground"
        >
          RAWG metadata
        </h2>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">
          Provider data
        </span>
      </div>

      {!payload ? (
        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium">No RAWG metadata yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata will appear here after this game is matched with RAWG.
          </p>
        </div>
      ) : (
        <div className="space-y-5 rounded-lg border border-border p-4">
          {payload.description && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {payload.description}
            </p>
          )}

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Released" value={payload.releaseDate} />
            <Field
              label="Rating"
              value={payload.rating === null ? null : `${payload.rating.toFixed(1)} / 5`}
            />
            <Field
              label="Metacritic"
              value={payload.metacriticScore === null ? null : `${payload.metacriticScore} / 100`}
            />
            <Field
              label="Playtime"
              value={payload.playtimeHours === null ? null : `${payload.playtimeHours} hours`}
            />
            <Field label="ESRB" value={payload.esrbRating?.name ?? null} />
            <Values label="Genres" values={payload.genres} />
            <Values label="Tags" values={payload.tags} />
            <Values label="Series" values={(payload.seriesGames ?? []).map((game) => game.name)} />
            <Values label="Developers" values={payload.developers} />
            <Values label="Publishers" values={payload.publishers} />
            <Values label="Alternative names" values={payload.alternativeNames} />
          </dl>

          {website && (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Visit official website
            </a>
          )}

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <p>
              Data provided by RAWG
              {fetchedAt ? `, fetched ${fetchedAt.toLocaleDateString("en-US")}` : ""}.
            </p>
            {source ? (
              <a
                href={source}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block underline-offset-4 hover:underline"
              >
                View source on RAWG
              </a>
            ) : (
              <p className="mt-1">RAWG source link unavailable.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
