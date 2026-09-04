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
import { rawgJobSelect, toRawgEnrichmentJobView } from "@/lib/rawg-job-view";
import { compatJobSelect } from "@/lib/compat-job";
import { awayGameUrl } from "@/lib/away-api";
import { parseProtonDbSummary, PROTONDB_APP_URL } from "@/lib/protondb-api";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import type { RawgMetadataPayload } from "@/lib/rawg-types";
import { GameDetailHero } from "@/components/games/GameDetailHero";
import { GameThemeScope } from "@/components/games/GameThemeScope";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { resolvePagePalette } from "@/lib/game-theme";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    game,
    manualCollections,
    possibleDuplicate,
    playDismissalCount,
    savedSources,
  ] = await Promise.all([
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

  const baseGames =
    game.type === "BASE_GAME"
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
  const compatJob = game.enrichmentJobs.find(
    (job) => job.provider === "PROTONDB",
  );
  const hasSteamIdentity = game.externalIds.length > 0;
  const steamAppId = game.externalIds[0]?.externalId ?? null;
  const isRomOnly =
    game.availability.some((a) => a.source === "ROM") &&
    !game.availability.some((a) => a.source === "STEAM");
  const protonDbSnapshot = game.compatSnapshots.find(
    (snapshot) => snapshot.provider === "PROTONDB",
  );
  const protonDb =
    steamAppId && protonDbSnapshot
      ? parseProtonDbSummary(steamAppId, protonDbSnapshot.result)
      : null;
  const awaySnapshot = game.compatSnapshots.find(
    (snapshot) => snapshot.provider === "ARE_WE_ANTICHEAT_YET",
  );
  const antiCheat = parseAntiCheatEvidence(awaySnapshot?.result);
  const latestSnapshotAt = game.compatSnapshots.reduce<Date | null>(
    (latest, snapshot) =>
      !latest || snapshot.fetchedAt > latest ? snapshot.fetchedAt : latest,
    null,
  );

  return (
    <GameThemeScope palette={resolvePagePalette(rawgPayload)}>
      <div className="space-y-8">
      <p className="technical-label text-muted-foreground">
        <a href="/library" className="hover:text-foreground hover:underline">
          Owned Games Library
        </a>
        <span aria-hidden="true"> / </span>
        <span>{game.name}</span>
      </p>

      <GameDetailHero
        id={game.id}
        name={game.name}
        type={game.type}
        origin={game.origin}
        addedAt={game.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        interest={game.libraryEntry?.interest ?? null}
        isInLibrary={game.libraryEntry !== null}
        imageUrl={
          rawgPayload && Array.isArray(rawgPayload.backgroundImageUrls)
            ? (rawgPayload.backgroundImageUrls[0] ?? null)
            : null
        }
      />

      <MetadataSection
        payload={rawgPayload}
        sourceUrl={rawgSnapshot?.sourceUrl ?? null}
        fetchedAt={rawgSnapshot?.fetchedAt ?? null}
      />

      <span id="play-state" />
      <SectionCard
        eyebrow="Play status"
        title="Play state"
        id="play-state"
        className="scroll-mt-6 outline-none target:ring-2 target:ring-primary/30 target:ring-offset-2 target:ring-offset-background"
        description="Choose the state that best reflects where this game stands for you."
        status={
          <StatusPill>
            {game.libraryEntry?.playState?.replaceAll("_", " ") ??
              "Not in library"}
          </StatusPill>
        }
      >
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
      </SectionCard>

      <SectionCard
        eyebrow="Catalog identity"
        title="Name"
        description="Keep the catalog name aligned with how you recognize this game."
      >
        {game.type === "DLC" && (
          <div className="mb-4">
            <ParentBaseGameBanner baseGame={game.baseGame} />
          </div>
        )}
        <GameNameForm
          key={game.name}
          gameId={game.id}
          initialName={game.name}
        />
      </SectionCard>

      {otherGameName && <DuplicateWarning otherGameName={otherGameName} />}

      <span id="personal-fields" />
      <SectionCard
        eyebrow="Personal"
        title="Profile"
        id="personal-fields"
        className="scroll-mt-6 outline-none target:ring-2 target:ring-primary/30 target:ring-offset-2 target:ring-offset-background"
        description="Your preferences and notes for this game."
        status={
          <StatusPill>
            {game.libraryEntry ? "Saved" : "Not in library"}
          </StatusPill>
        }
      >
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
      </SectionCard>

      <RawgEnrichmentPanel
        gameId={game.id}
        catalogName={game.name}
        initialJob={rawgJob ? toRawgEnrichmentJobView(rawgJob) : null}
        hasRawgSnapshot={game.metadataSnapshots.length > 0}
        rawgTitle={rawgPayload?.title ?? null}
      />

      <CompatibilitySection
        gameId={game.id}
        gameName={game.name}
        hasSteamIdentity={hasSteamIdentity}
        isRomOnly={isRomOnly}
        latestSnapshotAt={latestSnapshotAt}
        protonDb={
          protonDb
            ? {
                status: protonDb.status,
                tier: protonDb.tier,
              }
            : null
        }
        protonDbUrl={
          steamAppId
            ? `${PROTONDB_APP_URL}/${encodeURIComponent(steamAppId)}`
            : null
        }
        antiCheat={antiCheat}
        awayUrl={antiCheat && steamAppId ? awayGameUrl(steamAppId) : null}
        override={
          game.libraryEntry?.compatOverrideStatus
            ? {
                status: game.libraryEntry.compatOverrideStatus,
                reason: game.libraryEntry.compatOverrideReason,
              }
            : null
        }
        job={
          compatJob
            ? {
                status: compatJob.status,
                progress: compatJob.progress,
                lastErrorMessage: compatJob.lastErrorMessage,
              }
            : null
        }
      />

      <SectionCard
        eyebrow="Where it lives"
        title="Availability"
        id="availability"
        description="Sources and identity stay explicit and editable."
        status={
          <StatusPill>
            {game.availability.length} source
            {game.availability.length === 1 ? "" : "s"}
          </StatusPill>
        }
      >
        {game.externalIds[0] ? (
          <p className="mb-3 inline-flex rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Steam App {game.externalIds[0].externalId} confirmed
          </p>
        ) : (
          <div className="mb-3">
            <CatalogSteamIdentityForm gameId={game.id} gameName={game.name} />
          </div>
        )}
        <AvailabilityEditor
          gameId={game.id}
          rows={game.availability}
          savedSources={savedSources}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Organization"
        title="Tags"
        description="Personal labels for browsing and tuning."
        status={
          <StatusPill>
            {game.tags.length} tag{game.tags.length === 1 ? "" : "s"}
          </StatusPill>
        }
      >
        <TagsSection
          gameId={game.id}
          initialTags={game.tags.map((gt) => ({
            id: gt.tag.id,
            name: gt.tag.name,
          }))}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Organization"
        title="Collections"
        description="Personal structure for browsing and tuning."
        status={
          <StatusPill>
            {game.collections.length} collection
            {game.collections.length === 1 ? "" : "s"}
          </StatusPill>
        }
      >
        <CollectionsSection
          gameId={game.id}
          initialCollections={game.collections.map((cm) => ({
            id: cm.collection.id,
            name: cm.collection.name,
            color: cm.collection.color,
          }))}
          availableCollections={manualCollections}
        />
      </SectionCard>

      {game.type === "BASE_GAME" && (
        <DlcSection
          baseGameId={game.id}
          baseGameName={game.name}
          baseGames={baseGames}
          dlcs={game.dlcs}
          wishlistDlcs={game.wishlistDlcs}
        />
      )}

      <SectionCard
        eyebrow="Danger zone"
        title={`Delete ${game.name}`}
        description="Removes this game and its attached records. You can undo it shortly after."
        tone="danger"
      >
        <div className="flex justify-end">
          <DeleteGameDialog gameId={game.id} />
        </div>
      </SectionCard>
      </div>
    </GameThemeScope>
  );
}
