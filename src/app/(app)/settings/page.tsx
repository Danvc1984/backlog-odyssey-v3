import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { AccountCard } from "@/components/settings/AccountCard";
import { WishlistImportStatusCard } from "@/components/settings/WishlistImportStatusCard";
import { PriceStatusCard } from "@/components/settings/PriceStatusCard";
import { PersonalDataCard } from "@/components/settings/PersonalDataCard";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";
import { type IgdbBatchView, getLatestIgdbBatchStatus } from "@/lib/igdb-batch-runner";
import { getLatestWishlistCompatSweep } from "@/actions/wishlist-compatibility";
import { isCompatibilityActive } from "@/lib/os-setup";
import { DurationProfileCard } from "@/components/settings/DurationProfileCard";
import { DEFAULT_PRICE_PREFERENCES, pricePreferencesSchema } from "@/lib/price-preferences";

function CollapsibleSettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <details className="group space-y-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md [&::-webkit-details-marker]:hidden">
          <h2 className="section-label text-muted-foreground transition-colors group-open:text-foreground hover:text-foreground">
            {title}
          </h2>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </summary>
        {children}
      </details>
    </section>
  );
}

export default async function SettingsPage() {
  const session = await requireUser();
  const [
    steamConnection,
    appSettings,
    unresolvedDlcs,
    baseGames,
    latestCompatBatch,
    latestIgdbBatch,
    latestWishlistSweep,
    profile,
    preferences,
    sources,
    openWishlistImportReviews,
    ignoredWishlistImports,
    wallpaperState,
    latestPriceRefresh,
    exportGameCount,
    exportWishlistCount,
    exportRecommendationRunCount,
    wishlistEnrichmentEntries,
  ] = await Promise.all([
    prisma.steamConnection.findUnique({ where: { id: 1 } }),
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        wallpaperEnabled: true,
        primaryOs: true,
        hasWindowsFallback: true,
        handheldOs: true,
        onboardingCompleted: true,
        priceCountry: true,
        displayCurrency: true,
        durationProfile: true,
      },
    }),
    prisma.unresolvedSteamDlc.findMany({
      select: {
        id: true,
        steamAppId: true,
        name: true,
        steamBaseAppId: true,
        source: true,
        status: true,
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getLatestCompatBatchStatus(),
    getLatestIgdbBatchStatus(),
    getLatestWishlistCompatSweep(),
    prisma.recommendationProfile.findUnique({
      where: { id: 1 },
      select: { payload: true, rebuiltAt: true },
    }),
    prisma.recommendationPreference.findMany({
      orderBy: [{ dimension: "asc" }, { value: "asc" }],
    }),
    prisma.alternativeSource.findMany({
      include: { _count: { select: { availability: true } } },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    }),
    prisma.wishlistImportReview.count({ where: { status: "OPEN" } }),
    prisma.wishlistImportIgnore.count(),
    prisma.wallpaperState.findUnique({
      where: { id: 1 },
      select: { cachedAt: true, lastError: true },
    }),
    prisma.priceRefresh.findFirst({
      orderBy: { requestedAt: "desc" },
      select: { id: true, status: true, country: true, displayCurrency: true, counts: true, requestedAt: true, finishedAt: true },
    }),
    prisma.game.count(),
    prisma.wishlistEntry.count(),
    prisma.recommendationRun.count(),
    prisma.wishlistEntry.findMany({
      where: { type: { in: ["BASE_GAME", "DLC"] } },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const pricePreferences = pricePreferencesSchema.parse({
    priceCountry: appSettings?.priceCountry ?? DEFAULT_PRICE_PREFERENCES.priceCountry,
    displayCurrency: appSettings?.displayCurrency ?? DEFAULT_PRICE_PREFERENCES.displayCurrency,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="technical-label text-muted-foreground">Platform settings</p>
        <h1 className="mt-2">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Keep the ship&apos;s connections, appearance, provider upkeep, and recommendation course in your hands.
        </p>
      </div>
      <CollapsibleSettingsSection title="Account">
        <AccountCard
          email={session.user?.email ?? null}
          signOutAction={async () => {
            "use server";
            await signOut();
          }}
          settings={appSettings}
          pricePreferences={pricePreferences}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Appearance">
        <AppearanceSection
          initialWallpaperEnabled={appSettings?.wallpaperEnabled ?? true}
          poolCachedAt={wallpaperState?.cachedAt ?? null}
          lastError={wallpaperState?.lastError ?? null}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Steam and catalog sources">
        <SteamConnectionCard
          connected={Boolean(steamConnection)}
          steamId64={steamConnection?.steamId64 ?? null}
        />
        <AlternativeSourcesCard sources={sources} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Recommendations">
        <DurationProfileCard initialProfile={appSettings?.durationProfile ?? "NORMALLY"} />
        <RecommendationProfileSection
          profile={profile}
          preferences={preferences}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Provider workers and services">
        {openWishlistImportReviews > 0 && (
          <WishlistImportStatusCard
            openReviews={openWishlistImportReviews}
            ignored={ignoredWishlistImports}
          />
        )}
        {unresolvedDlcs.length > 0 && (
          <UnresolvedDlcReviewCard items={unresolvedDlcs} baseGames={baseGames} />
        )}
        <PriceStatusCard lastRun={latestPriceRefresh} />
        <CompatibilitySweepPanel
          compatibilityActive={appSettings ? isCompatibilityActive(appSettings) : false}
          initialBatch={latestCompatBatch?.data ?? null}
          initialIgdbBatch={
            (latestIgdbBatch?.data ?? null) as IgdbBatchView | null
          }
          initialWishlistRun={
            latestWishlistSweep.data
              ? {
                  id: latestWishlistSweep.data.id,
                  status: latestWishlistSweep.data.status,
                  counts: latestWishlistSweep.data.counts,
                  requestedAt: latestWishlistSweep.data.requestedAt,
                  finishedAt: latestWishlistSweep.data.finishedAt,
                }
              : null
          }
          wishlistEntryIds={wishlistEnrichmentEntries.map((entry) => entry.id)}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Data export and restore">
        <PersonalDataCard
          gameCount={exportGameCount}
          wishlistCount={exportWishlistCount}
          recommendationRunCount={exportRecommendationRunCount}
        />
      </CollapsibleSettingsSection>
    </div>
  );
}
