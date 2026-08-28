import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PersonalFieldsForm } from "@/components/games/PersonalFieldsForm";
import { PlayStateSection } from "@/components/games/PlayStateSection";
import { TagsSection } from "@/components/games/TagsSection";
import { CollectionsSection } from "@/components/games/CollectionsSection";
import { DuplicateWarning } from "@/components/games/DuplicateWarning";
import { DeleteGameDialog } from "@/components/games/DeleteGameDialog";
import { AvailabilityEditor } from "@/components/games/AvailabilityEditor";
import { GameNameForm } from "@/components/games/GameNameForm";
import { MetadataSection } from "@/components/games/MetadataSection";
import { RawgEnrichmentPanel } from "@/components/games/RawgEnrichmentPanel";
import { DlcSection } from "@/components/games/DlcSection";
import { ParentBaseGameBanner } from "@/components/games/ParentBaseGameBanner";
import { CatalogSteamIdentityForm } from "@/components/games/CatalogSteamIdentityForm";
import { CompatibilitySection } from "@/components/games/CompatibilitySection";
import { CalibrationNote } from "@/components/recommendations/CalibrationNote";
import { caveatChip, factorChip } from "@/components/recommendations/FactorChips";
import { rawgJobSelect, toRawgEnrichmentJobView } from "@/lib/rawg-job-view";
import type { ExplanationFactor as ExplanationFactorShape, ExplanationCaveat as ExplanationCaveatShape } from "@/lib/recommendations/types";
import { compatJobSelect } from "@/lib/compat-job";
import { awayGameUrl } from "@/lib/away-api";
import { parseProtonDbSummary, PROTONDB_APP_URL } from "@/lib/protondb-api";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import type { RawgMetadataPayload } from "@/lib/rawg-types";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: "Manual entry",
  STEAM_IMPORT: "Steam import",
};

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, manualCollections, possibleDuplicate, latestPlayNextRun, playDismissalCount, savedSources] = await Promise.all([
    prisma.game.findUnique({
      where: { id },
      include: {
        baseGame: {
          select: { id: true, name: true },
        },
        libraryEntry: true,
        availability: true,
        externalIds: {
          where: { namespace: "STEAM_APP" },
          select: { externalId: true },
        },
        tags: {
          include: { tag: true },
        },
        collections: {
          include: { collection: true },
        },
        dlcs: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
        wishlistDlcs: {
          where: { type: "DLC" },
          select: { id: true, name: true, interest: true },
          orderBy: [{ interest: "desc" }, { name: "asc" }],
        },
        metadataSnapshots: {
          where: { provider: "RAWG" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true, sourceUrl: true, fetchedAt: true },
        },
        compatSnapshots: {
          orderBy: { fetchedAt: "desc" },
          select: { provider: true, result: true, fetchedAt: true },
        },
        enrichmentJobs: {
          where: { provider: { in: ["RAWG", "PROTONDB"] } },
          select: { ...rawgJobSelect, ...compatJobSelect },
        },
      },
    }),
    prisma.collection.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.possibleDuplicate.findFirst({
      where: {
        status: "OPEN",
        OR: [{ gameAId: id }, { gameBId: id }],
      },
      select: {
        gameAId: true,
        gameBId: true,
        gameA: { select: { name: true } },
        gameB: { select: { name: true } },
      },
    }),
    prisma.recommendationRun.findFirst({
      where: { kind: "PLAY_NEXT" },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          where: { gameId: id },
          select: { id: true, rank: true, score: true, positive: true, negative: true, caveats: true },
        },
      },
    }),
    prisma.recommendationFeedback.count({
      where: { gameId: id, kind: "PLAY_NEXT" },
    }),
    prisma.alternativeSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, archivedAt: true },
    }),
  ]);

  if (!game) {
    redirect("/library");
  }
  if (game.type === "DLC" && game.baseGameId) {
    redirect(`/games/${game.baseGameId}`);
  }

  const baseGames = game.type === "BASE_GAME"
    ? await prisma.game.findMany({
        where: { type: "BASE_GAME" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const otherGameName = possibleDuplicate
    ? possibleDuplicate.gameAId === id
      ? possibleDuplicate.gameB.name
      : possibleDuplicate.gameA.name
    : null;
  const rawgSnapshot = game.metadataSnapshots[0];
  const rawgPayload = rawgSnapshot
    ? (rawgSnapshot.payload as unknown as RawgMetadataPayload)
    : null;
  const rawgJob = game.enrichmentJobs.find((job) => job.provider === "RAWG");
  const compatJob = game.enrichmentJobs.find((job) => job.provider === "PROTONDB");
  const hasSteamIdentity = game.externalIds.length > 0;
  const steamAppId = game.externalIds[0]?.externalId ?? null;
  const isRomOnly = game.availability.some((a) => a.source === "ROM") &&
    !game.availability.some((a) => a.source === "STEAM");
  const protonDbSnapshot = game.compatSnapshots.find((snapshot) => snapshot.provider === "PROTONDB");
  const protonDb = steamAppId && protonDbSnapshot
    ? parseProtonDbSummary(steamAppId, protonDbSnapshot.result)
    : null;
  const awaySnapshot = game.compatSnapshots.find((snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET");
  const antiCheat = parseAntiCheatEvidence(awaySnapshot?.result);
  const latestSnapshotAt = game.compatSnapshots.reduce<Date | null>(
    (latest, snapshot) => (!latest || snapshot.fetchedAt > latest ? snapshot.fetchedAt : latest),
    null,
  );

  const recommendationItem = latestPlayNextRun?.items[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{game.name}</h1>
        {game.type === "DLC" && (
          <div className="mt-4">
            <ParentBaseGameBanner baseGame={game.baseGame} />
          </div>
        )}
        <div className="mt-4">
          <GameNameForm key={game.name} gameId={game.id} initialName={game.name} />
        </div>
      </div>

      {otherGameName && <DuplicateWarning otherGameName={otherGameName} />}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Metadata
        </h2>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Type</span>
            <span className="ml-2 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
              {TYPE_LABELS[game.type] ?? game.type}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Origin</span>
            <span className="ml-2">{ORIGIN_LABELS[game.origin] ?? game.origin}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Added</span>
            <span className="ml-2">
              {game.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <MetadataSection
          payload={rawgPayload}
          sourceUrl={rawgSnapshot?.sourceUrl ?? null}
          fetchedAt={rawgSnapshot?.fetchedAt ?? null}
        />
        <RawgEnrichmentPanel
          gameId={game.id}
          catalogName={game.name}
          initialJob={
            rawgJob ? toRawgEnrichmentJobView(rawgJob) : null
          }
          hasRawgSnapshot={game.metadataSnapshots.length > 0}
          rawgTitle={rawgPayload?.title ?? null}
        />
      </div>

      <CompatibilitySection
        gameId={game.id}
        gameName={game.name}
        hasSteamIdentity={hasSteamIdentity}
        isRomOnly={isRomOnly}
        latestSnapshotAt={latestSnapshotAt}
        protonDb={protonDb ? {
          status: protonDb.status,
          tier: protonDb.tier,
        } : null}
        protonDbUrl={steamAppId ? `${PROTONDB_APP_URL}/${encodeURIComponent(steamAppId)}` : null}
        antiCheat={antiCheat}
        awayUrl={antiCheat && steamAppId ? awayGameUrl(steamAppId) : null}
        override={game.libraryEntry?.compatOverrideStatus ? {
          status: game.libraryEntry.compatOverrideStatus,
          reason: game.libraryEntry.compatOverrideReason,
        } : null}
        job={compatJob ? {
          status: compatJob.status,
          progress: compatJob.progress,
          lastErrorMessage: compatJob.lastErrorMessage,
        } : null}
      />

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Availability
        </h2>
        {game.externalIds[0] ? (
          <p className="mb-3 inline-flex rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Steam App {game.externalIds[0].externalId} confirmed
          </p>
        ) : (
          <div className="mb-3">
            <CatalogSteamIdentityForm gameId={game.id} gameName={game.name} />
          </div>
        )}
        <div className="rounded-lg border border-border">
          <AvailabilityEditor
            gameId={game.id}
            rows={game.availability}
            savedSources={savedSources}
          />
        </div>
      </section>

      {recommendationItem && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Latest recommendation
          </h2>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-medium">#{recommendationItem.rank}</span>
              <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                {recommendationItem.score} pts
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[recommendationItem.positive, recommendationItem.negative].flatMap((value) =>
                Array.isArray(value) ? (value as unknown[]).filter(
                  (factor): factor is ExplanationFactorShape =>
                    typeof factor === "object" && factor !== null && typeof (factor as ExplanationFactorShape).label === "string",
                ).map((factor) => factorChip(factor)) : [],
              )}
              {Array.isArray(recommendationItem.caveats) &&
                (recommendationItem.caveats as unknown[]).filter(
                  (caveat): caveat is ExplanationCaveatShape =>
                    typeof caveat === "object" && caveat !== null && typeof (caveat as ExplanationCaveatShape).label === "string",
                ).map((caveat) => caveatChip(caveat))}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Personal fields
        </h2>
        <PersonalFieldsForm
          gameId={game.id}
          libraryEntry={
            game.libraryEntry
              ? {
                  priority: game.libraryEntry.priority,
                  interest: game.libraryEntry.interest,
                  rating: game.libraryEntry.rating,
                  preferredEnvironment: game.libraryEntry.preferredEnvironment,
                  gameExperience: game.libraryEntry.gameExperience,
                  notes: game.libraryEntry.notes,
                }
              : null
          }
        />
        <CalibrationNote
          interest={game.libraryEntry?.interest ?? null}
          dismissalCount={playDismissalCount}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Tags
        </h2>
        <TagsSection
          gameId={game.id}
          initialTags={game.tags.map((gt) => ({
            id: gt.tag.id,
            name: gt.tag.name,
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Collections
        </h2>
        <CollectionsSection
          gameId={game.id}
          initialCollections={game.collections.map((cm) => ({
            id: cm.collection.id,
            name: cm.collection.name,
            color: cm.collection.color,
          }))}
          availableCollections={manualCollections}
        />
      </section>

      {game.type === "BASE_GAME" && (
        <DlcSection
          baseGameId={game.id}
          baseGameName={game.name}
          baseGames={baseGames}
          dlcs={game.dlcs}
          wishlistDlcs={game.wishlistDlcs}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Play state
        </h2>
        <PlayStateSection
          gameId={game.id}
          libraryEntry={
            game.libraryEntry
              ? {
                  playState: game.libraryEntry.playState,
                  isMainGame: game.libraryEntry.isMainGame,
                  playSoon: game.libraryEntry.playSoon,
                  replayCandidate: game.libraryEntry.replayCandidate,
                  hidden: game.libraryEntry.hidden,
                }
              : null
          }
        />
      </section>

      <section className="flex items-center justify-between border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Delete {game.name}</h2>
          <p className="text-sm text-muted-foreground">
            Removes this game and its attached records. You can undo it shortly after.
          </p>
        </div>
        <DeleteGameDialog gameId={game.id} />
      </section>
    </div>
  );
}
