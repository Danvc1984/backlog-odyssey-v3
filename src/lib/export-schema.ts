import { z } from "zod";
import { EXPORT_VERSION } from "./export-data";

const isoDateTime = z.iso.datetime();

const appSettingsSchema = z.object({
  id: z.number().int(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  desktopOs: z.string(),
  portableDevice: z.string(),
  fallbackOs: z.string(),
  priceCountry: z.string(),
  timeZone: z.string(),
  wallpaperEnabled: z.boolean(),
  reducedData: z.boolean(),
  steamDailySyncEnabled: z.boolean(),
  itadDailyRefresh: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const gameSchema = z.object({
  id: z.string(),
  type: z.enum(["BASE_GAME", "DLC"]),
  origin: z.enum(["STEAM_IMPORT", "MANUAL"]),
  name: z.string(),
  baseGameId: z.string().nullable(),
  importAt: isoDateTime,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const libraryEntrySchema = z.object({
  id: z.string(),
  gameId: z.string(),
  playState: z.enum(["NOT_STARTED", "IN_PROGRESS", "PLAYED_BEFORE", "ABANDONED"]),
  isMainGame: z.boolean(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).nullable(),
  interest: z.number().int().nullable(),
  rating: z.number().int().nullable(),
  preferredEnvironment: z.enum(["BAZZITE", "STEAM_DECK", "WINDOWS"]).nullable(),
  gameExperience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable(),
  compatOverrideStatus: z
    .enum(["READY", "READY_WITH_TINKERING", "FALLBACK_RECOMMENDED", "REQUIRED", "UNKNOWN"])
    .nullable(),
  compatOverrideReason: z.string().nullable(),
  playSoon: z.boolean(),
  replayCandidate: z.boolean(),
  hidden: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const availabilityRowSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]),
  alternativeSourceId: z.string().nullable(),
  displayName: z.string().nullable(),
  steamAppId: z.string().nullable(),
  steamPlaytimeTotal: z.string().nullable(),
  steamLastPlayed: isoDateTime.nullable(),
  addedAt: isoDateTime,
});

const externalIdSchema = z.object({
  id: z.string(),
  namespaceId: z.string(),
  namespace: z.string(),
  externalId: z.string(),
  matchMethod: z.enum(["EXACT_STEAM_APP_ID", "MANUAL_RAWG_SEARCH", "MANUAL_ITAD_LOOKUP", "INFERRED"]),
  gameId: z.string(),
});

const alternativeSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  knownKey: z.string().nullable(),
  archivedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const personalTagSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const gameTagSchema = z.object({
  gameId: z.string(),
  tagId: z.string(),
});

const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: isoDateTime,
});

const collectionMembershipSchema = z.object({
  collectionId: z.string(),
  gameId: z.string(),
  addedAt: isoDateTime,
});

export const settingsSchema = appSettingsSchema;
export const gamesSchema = z.array(gameSchema);
export const libraryEntriesSchema = z.array(libraryEntrySchema);
export const availabilitySchema = z.array(availabilityRowSchema);
export const externalIdsSchema = z.array(externalIdSchema);
export const alternativeSourcesSchema = z.array(alternativeSourceSchema);
export const tagsSchema = z.array(personalTagSchema);
export const gameTagsSchema = z.array(gameTagSchema);
export const collectionsSchema = z.array(collectionSchema);
export const collectionMembershipsSchema = z.array(collectionMembershipSchema);

const wishlistEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["BASE_GAME", "DLC"]),
  baseGameId: z.string().nullable(),
  interest: z.number().int().nullable(),
  gameExperience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable(),
  targetPriceMxn: z.string().nullable(),
  notes: z.string().nullable(),
  steamAppId: z.string().nullable(),
  steamAppIdProvenance: z.enum(["STEAM_IMPORT", "USER", "RAWG_SUGGESTION"]).nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const unresolvedDlcRowSchema = z.object({
  id: z.string(),
  steamAppId: z.string(),
  name: z.string(),
  steamBaseAppId: z.string().nullable(),
  source: z.enum(["OWNED_SYNC", "WISHLIST_IMPORT"]),
  status: z.enum(["PENDING", "DISCARDED"]),
  discardedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const wishlistImportReviewSchema = z.object({
  id: z.string(),
  steamAppId: z.string(),
  name: z.string(),
  candidates: z.unknown(),
  status: z.enum(["OPEN", "LINKED", "IGNORED"]),
  reviewedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const wishlistImportIgnoreSchema = z.object({
  id: z.string(),
  steamAppId: z.string(),
  name: z.string(),
  createdAt: isoDateTime,
});

const possibleDuplicateSchema = z.object({
  id: z.string(),
  gameAId: z.string(),
  gameBId: z.string(),
  evidence: z.unknown().nullable(),
  confidence: z.number().nullable(),
  status: z.enum(["OPEN", "DISMISSED"]),
  reviewedAt: isoDateTime.nullable(),
});

const recommendationRunSchema = z.object({
  id: z.string(),
  kind: z.enum(["PLAY_NEXT", "BUY"]),
  context: z.unknown().nullable(),
  createdAt: isoDateTime,
});

const recommendationItemSchema = z.object({
  id: z.string(),
  runId: z.string(),
  gameId: z.string().nullable(),
  wishlistEntryId: z.string().nullable(),
  rank: z.number().int(),
  score: z.number(),
  positive: z.unknown().nullable(),
  negative: z.unknown().nullable(),
  caveats: z.unknown().nullable(),
  role: z.enum(["BEST_FIT_1", "BEST_FIT_2", "OUT_OF_THE_BOX", "CHANGE_OF_PACE", "DEAL"]).nullable(),
  createdAt: isoDateTime,
});

const recommendationFeedbackSchema = z.object({
  id: z.string(),
  gameId: z.string().nullable(),
  wishlistEntryId: z.string().nullable(),
  kind: z.enum(["PLAY_NEXT", "BUY"]),
  createdAt: isoDateTime,
});

const recommendationEventSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "EXPOSURE",
    "ROTATION",
    "TASTE_SETUP_ANSWER",
    "START",
    "COMPLETION",
    "ABANDONMENT",
    "DISMISSAL",
  ]),
  gameId: z.string().nullable(),
  wishlistEntryId: z.string().nullable(),
  runId: z.string().nullable(),
  reason: z.string().nullable(),
  payload: z.unknown().nullable(),
  createdAt: isoDateTime,
});

const recommendationProfileSchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  payload: z.unknown(),
  rebuiltAt: isoDateTime,
  updatedAt: isoDateTime,
});

const recommendationPreferenceSchema = z.object({
  id: z.string(),
  dimension: z.enum([
    "GENRE",
    "TAG",
    "EXPERIENCE",
    "DURATION",
    "PUBLISHER",
    "ERA",
    "SERIES",
    "ENVIRONMENT",
    "MATURITY",
  ]),
  value: z.string(),
  attitude: z.enum(["PREFER", "NEUTRAL", "AVOID"]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const recommendationTuneStateSchema = z.object({
  id: z.number().int(),
  playTune: z.unknown().nullable(),
  buyTune: z.unknown().nullable(),
  updatedAt: isoDateTime,
});

const recommendationPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  tune: z.unknown(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const recommendationsObjectSchema = z.object({
  runs: z.array(recommendationRunSchema),
  items: z.array(recommendationItemSchema),
  feedback: z.array(recommendationFeedbackSchema),
  events: z.array(recommendationEventSchema),
  profile: recommendationProfileSchema.nullable(),
  preferences: z.array(recommendationPreferenceSchema),
  tuneState: recommendationTuneStateSchema.nullable(),
  presets: z.array(recommendationPresetSchema),
});

export const wishlistSchema = z.array(wishlistEntrySchema);
export const unresolvedDlcSchema = z.array(unresolvedDlcRowSchema);
export const wishlistImportReviewsSchema = z.array(wishlistImportReviewSchema);
export const wishlistImportIgnoresSchema = z.array(wishlistImportIgnoreSchema);
export const possibleDuplicatesSchema = z.array(possibleDuplicateSchema);
export const recommendationsSchema = recommendationsObjectSchema;

export const exportDocumentSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: isoDateTime,
  data: z.object({
    settings: settingsSchema.nullable(),
    games: gamesSchema,
    libraryEntries: libraryEntriesSchema,
    availability: availabilitySchema,
    externalIds: externalIdsSchema,
    alternativeSources: alternativeSourcesSchema,
    tags: tagsSchema,
    gameTags: gameTagsSchema,
    collections: collectionsSchema,
    collectionMemberships: collectionMembershipsSchema,
    wishlist: wishlistSchema,
    unresolvedDlc: unresolvedDlcSchema,
    wishlistImportReviews: wishlistImportReviewsSchema,
    wishlistImportIgnores: wishlistImportIgnoresSchema,
    possibleDuplicates: possibleDuplicatesSchema,
    recommendations: recommendationsSchema,
  }),
});

export type ExportDocument = z.infer<typeof exportDocumentSchema>;

export { EXPORT_VERSION };
