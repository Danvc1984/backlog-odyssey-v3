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
import { IgdbEnrichmentPanel } from "@/components/games/IgdbEnrichmentPanel";
import { HashScrollTarget } from "@/components/ui/HashScrollTarget";
import { DlcSection } from "@/components/games/DlcSection";
import { ScreenshotsSection } from "@/components/games/ScreenshotsSection";
import { ParentBaseGameBanner } from "@/components/games/ParentBaseGameBanner";
import { CatalogSteamIdentityForm } from "@/components/games/CatalogSteamIdentityForm";
import { CompatibilitySection } from "@/components/games/CompatibilitySection";
import { CalibrationNote } from "@/components/recommendations/CalibrationNote";
import { igdbJobSelect, toIgdbEnrichmentJobView } from "@/lib/igdb-job-view";
import { compatJobSelect } from "@/lib/compat-job";
import { awayGameUrl } from "@/lib/away-api";
import { parseProtonDbSummary, PROTONDB_APP_URL } from "@/lib/protondb-api";
import { parseAntiCheatEvidence } from "@/lib/compat-evidence";
import type { IgdbMetadataPayload } from "@/lib/igdb-types";
import { resolveIgdbPageScreenshots } from "@/lib/screenshot-view";
import { GameDetailHero } from "@/components/games/GameDetailHero";
import { GameThemeScope } from "@/components/games/GameThemeScope";
import { SectionCard, StatusPill } from "@/components/ui/detail-card";
import { resolvePagePalette } from "@/lib/game-theme";
import { deriveWindowsFallbackExists, linuxDevicePhrase } from "@/lib/os-setup";
import { getCompatibilityGate } from "@/lib/compat-gate";
import { availableEnvironments } from "@/lib/recommendations/environment-fit";
import type { DurationProfile } from "@/lib/playtime-evidence";

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
    compatibilityGate,
    appSettings,
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
          where: { provider: "IGDB" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true, sourceUrl: true, fetchedAt: true },
        },
        playtimeEvidence: {
          select: { provider: true, payload: true, sourceUrl: true, fetchedAt: true },
        },
        compatSnapshots: {
          orderBy: { fetchedAt: "desc" },
          select: { provider: true, result: true, fetchedAt: true },
        },
        enrichmentJobs: {
          where: { provider: { in: ["IGDB", "PROTONDB"] } },
          select: { ...igdbJobSelect, ...compatJobSelect },
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
    getCompatibilityGate(),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { durationProfile: true } }),
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
  const igdbSnapshot = game.metadataSnapshots[0];
  const durationEvidence = game.playtimeEvidence;
  const durationProfile = (appSettings?.durationProfile ?? "NORMALLY") as DurationProfile;
  const igdbJob = game.enrichmentJobs.find((job) => job.provider === "IGDB");
  const igdbPayload = igdbSnapshot
    ? (igdbSnapshot.payload as unknown as IgdbMetadataPayload)
    : null;
  const screenshots = resolveIgdbPageScreenshots(igdbPayload);
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
  const configuredEnvironments = availableEnvironments(
    compatibilityGate.setup ?? {
      primaryOs: "LINUX",
      hasWindowsFallback: false,
      handheldOs: "NONE",
    },
  );
  const configuredLinuxDevicePhrase = linuxDevicePhrase(
    compatibilityGate.setup ?? { primaryOs: "LINUX", handheldOs: "NONE" },
  );

  return (
    <GameThemeScope palette={resolvePagePalette(igdbPayload)}>
      <div className="space-y-8">
        <HashScrollTarget />
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
            igdbPayload
              ? (igdbPayload.artworkUrls[0] ?? igdbPayload.screenshots[0]?.image ?? igdbPayload.coverUrl ?? null)
            : null
        }
      />

      <MetadataSection
        payload={igdbPayload}
        sourceUrl={igdbSnapshot?.sourceUrl ?? null}
        fetchedAt={igdbSnapshot?.fetchedAt ?? null}
        durationEvidence={durationEvidence}
        durationProfile={durationProfile}
      />

      <IgdbEnrichmentPanel
        gameId={game.id}
        catalogName={game.name}
        initialJob={igdbJob ? toIgdbEnrichmentJobView(igdbJob) : null}
        hasIgdbSnapshot={igdbSnapshot !== undefined}
        igdbTitle={igdbPayload?.name ?? null}
      />

      <SectionCard
        eyebrow="Play status"
        title="Play state"
        id="play-state"
        sectionId="play-state"
        className="scroll-mt-6 outline-none target:ring-2 target:ring-primary/30 target:ring-offset-2 target:ring-offset-background"
        description="Set the course for where this game stands in your voyage."
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
                  handheldSuitable: game.libraryEntry.handheldSuitable,
                }
              : null
          }
        />
      </SectionCard>

      <SectionCard
        eyebrow="Catalog identity"
        title="Name"
        description="Keep the catalog name true to the way you know this game."
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

      <SectionCard
        eyebrow="Personal"
        title="Profile"
        id="personal-fields"
        sectionId="personal-fields"
        className="scroll-mt-6 outline-none target:ring-2 target:ring-primary/30 target:ring-offset-2 target:ring-offset-background"
        description="Your preferences and notes for the journey."
        status={
          <StatusPill>
            {game.libraryEntry ? "Saved" : "Not in library"}
          </StatusPill>
        }
      >
        <PersonalFieldsForm
          gameId={game.id}
          availableEnvironments={configuredEnvironments}
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

      {compatibilityGate.active && game.type === "BASE_GAME" && (
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
        hasWindowsFallback={compatibilityGate.setup ? deriveWindowsFallbackExists(compatibilityGate.setup) : false}
        linuxDevicePhrase={configuredLinuxDevicePhrase}
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
      )}

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
        description="Personal markers for finding your way back."
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
        description="Your chosen harbors for browsing and tuning."
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

      <ScreenshotsSection
        id={game.id}
        title={game.name}
        screenshots={screenshots}
        artworkUrls={igdbPayload?.artworkUrls}
        conceptArtUrls={igdbPayload?.conceptArtUrls}
        coverUrl={igdbPayload?.coverUrl}
        sourceUrl={igdbSnapshot?.sourceUrl ?? igdbPayload?.attribution.sourceUrl ?? null}
        provider="IGDB"
      />

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
