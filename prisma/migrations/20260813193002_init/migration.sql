-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('BASE_GAME', 'DLC');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('STEAM_IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('EXACT_STEAM_APP_ID', 'MANUAL_RAWG_SEARCH', 'MANUAL_ITAD_LOOKUP', 'INFERRED');

-- CreateEnum
CREATE TYPE "AvailabilitySource" AS ENUM ('STEAM', 'OTHER_PLATFORM', 'ROM');

-- CreateEnum
CREATE TYPE "PlayState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PLAYED_BEFORE', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('BAZZITE', 'STEAM_DECK', 'WINDOWS');

-- CreateEnum
CREATE TYPE "CompatibilityStatus" AS ENUM ('READY', 'READY_WITH_TINKERING', 'FALLBACK_RECOMMENDED', 'REQUIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('OPEN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RecommendationKind" AS ENUM ('PLAY_NEXT', 'BUY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('PROTONDB', 'ARE_WE_ANTICHEAT_YET', 'STEAM_DECK_VERIFIED', 'RAWG', 'ITAD', 'STEAM', 'WALLHAVEN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "desktopOs" TEXT NOT NULL DEFAULT 'BAZZITE',
    "portableDevice" TEXT NOT NULL DEFAULT 'STEAM_DECK',
    "fallbackOs" TEXT NOT NULL DEFAULT 'WINDOWS',
    "priceCountry" TEXT NOT NULL DEFAULT 'MX',
    "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "wallpaperEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reducedData" BOOLEAN NOT NULL DEFAULT false,
    "steamDailySyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "itadDailyRefresh" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "steamId64" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "counts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "type" "GameType" NOT NULL DEFAULT 'BASE_GAME',
    "origin" "Origin" NOT NULL,
    "name" TEXT NOT NULL,
    "baseGameId" TEXT,
    "importAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalGameId" (
    "id" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "matchMethod" "MatchMethod" NOT NULL DEFAULT 'EXACT_STEAM_APP_ID',
    "gameId" TEXT NOT NULL,

    CONSTRAINT "ExternalGameId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MetadataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PersonalTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTag" (
    "gameId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "GameTag_pkey" PRIMARY KEY ("gameId","tagId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionMembership" (
    "collectionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionMembership_pkey" PRIMARY KEY ("collectionId","gameId")
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playState" "PlayState" NOT NULL DEFAULT 'NOT_STARTED',
    "isMainGame" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" DEFAULT 'NONE',
    "interest" INTEGER,
    "rating" INTEGER,
    "preferredEnvironment" "Environment",
    "compatOverrideStatus" "CompatibilityStatus",
    "compatOverrideReason" TEXT,
    "playSoon" BOOLEAN NOT NULL DEFAULT false,
    "replayCandidate" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAvailability" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "source" "AvailabilitySource" NOT NULL,
    "displayName" TEXT,
    "steamAppId" TEXT,
    "steamPlaytimeTotal" BIGINT,
    "steamLastPlayed" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "interest" INTEGER,
    "targetPrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealOffer" (
    "id" TEXT NOT NULL,
    "wishlistEntryId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "country" TEXT,
    "currency" TEXT,
    "price" DECIMAL(10,2),
    "regularPrice" DECIMAL(10,2),
    "discount" INTEGER,
    "historicalLow" DECIMAL(10,2),
    "voucher" TEXT,
    "drm" TEXT,
    "platforms" JSONB,
    "url" TEXT,
    "expiresAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRefresh" (
    "id" TEXT NOT NULL,
    "wishlistEntryId" TEXT,
    "status" "SyncStatus" NOT NULL,
    "country" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "counts" JSONB,

    CONSTRAINT "PriceRefresh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilitySnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "result" JSONB,
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CompatibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentCompatibility" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "status" "CompatibilityStatus" NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PossibleDuplicate" (
    "id" TEXT NOT NULL,
    "gameAId" TEXT NOT NULL,
    "gameBId" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PossibleDuplicate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL,
    "kind" "RecommendationKind" NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "positive" JSONB,
    "negative" JSONB,
    "caveats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallpaperState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "candidates" JSONB,
    "selectedIdx" INTEGER NOT NULL DEFAULT 0,
    "renderTarget" JSONB,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallpaperState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "counts" JSONB,
    "diagnostics" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "SteamConnection_steamId64_key" ON "SteamConnection"("steamId64");

-- CreateIndex
CREATE INDEX "Game_baseGameId_idx" ON "Game"("baseGameId");

-- CreateIndex
CREATE INDEX "Game_origin_idx" ON "Game"("origin");

-- CreateIndex
CREATE INDEX "Game_type_idx" ON "Game"("type");

-- CreateIndex
CREATE INDEX "ExternalGameId_gameId_idx" ON "ExternalGameId"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalGameId_namespace_externalId_key" ON "ExternalGameId"("namespace", "externalId");

-- CreateIndex
CREATE INDEX "MetadataSnapshot_gameId_provider_idx" ON "MetadataSnapshot"("gameId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalTag_name_key" ON "PersonalTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_name_key" ON "Collection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_gameId_key" ON "LibraryEntry"("gameId");

-- CreateIndex
CREATE INDEX "LibraryEntry_playState_idx" ON "LibraryEntry"("playState");

-- CreateIndex
CREATE INDEX "LibraryEntry_isMainGame_idx" ON "LibraryEntry"("isMainGame");

-- CreateIndex
CREATE INDEX "GameAvailability_gameId_idx" ON "GameAvailability"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistEntry_gameId_key" ON "WishlistEntry"("gameId");

-- CreateIndex
CREATE INDEX "WishlistEntry_gameId_idx" ON "WishlistEntry"("gameId");

-- CreateIndex
CREATE INDEX "DealOffer_wishlistEntryId_idx" ON "DealOffer"("wishlistEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompatibilitySnapshot_gameId_provider_key" ON "CompatibilitySnapshot"("gameId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentCompatibility_gameId_environment_key" ON "EnvironmentCompatibility"("gameId", "environment");

-- CreateIndex
CREATE INDEX "PossibleDuplicate_status_idx" ON "PossibleDuplicate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PossibleDuplicate_gameAId_gameBId_key" ON "PossibleDuplicate"("gameAId", "gameBId");

-- CreateIndex
CREATE INDEX "RecommendationRun_kind_createdAt_idx" ON "RecommendationRun"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationItem_runId_idx" ON "RecommendationItem"("runId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_gameId_kind_idx" ON "RecommendationFeedback"("gameId", "kind");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_baseGameId_fkey" FOREIGN KEY ("baseGameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalGameId" ADD CONSTRAINT "ExternalGameId_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataSnapshot" ADD CONSTRAINT "MetadataSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTag" ADD CONSTRAINT "GameTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "PersonalTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMembership" ADD CONSTRAINT "CollectionMembership_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMembership" ADD CONSTRAINT "CollectionMembership_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryEntry" ADD CONSTRAINT "LibraryEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAvailability" ADD CONSTRAINT "GameAvailability_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistEntry" ADD CONSTRAINT "WishlistEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOffer" ADD CONSTRAINT "DealOffer_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRefresh" ADD CONSTRAINT "PriceRefresh_wishlistEntryId_fkey" FOREIGN KEY ("wishlistEntryId") REFERENCES "WishlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilitySnapshot" ADD CONSTRAINT "CompatibilitySnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentCompatibility" ADD CONSTRAINT "EnvironmentCompatibility_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PossibleDuplicate" ADD CONSTRAINT "PossibleDuplicate_gameAId_fkey" FOREIGN KEY ("gameAId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PossibleDuplicate" ADD CONSTRAINT "PossibleDuplicate_gameBId_fkey" FOREIGN KEY ("gameBId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
