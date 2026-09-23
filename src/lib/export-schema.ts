import { z } from "zod";
import { EXPORT_VERSION } from "./export-data";
import { normalizePersonalTagName } from "./personal-tag";
import { displayCurrencySchema, priceCountrySchema } from "./price-preferences";

const isoDateTime = z.iso.datetime();

const appSettingsSchema = z.strictObject({
  id: z.number().int(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  primaryOs: z.enum(["LINUX", "WINDOWS"]),
  hasWindowsFallback: z.boolean(),
  handheldOs: z.enum(["NONE", "LINUX", "WINDOWS"]),
  onboardingCompleted: z.boolean(),
  priceCountry: priceCountrySchema,
  displayCurrency: displayCurrencySchema.default("MXN"),
  timeZone: z.string(),
  wallpaperEnabled: z.boolean(),
  reducedData: z.boolean(),
  durationProfile: z.enum(["HASTILY", "NORMALLY", "COMPLETELY"]),
  steamDailySyncEnabled: z.boolean(),
  itadDailyRefresh: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const gameSchema = z.strictObject({
  id: z.string(),
  type: z.enum(["BASE_GAME", "DLC"]),
  origin: z.enum(["STEAM_IMPORT", "MANUAL"]),
  name: z.string(),
  baseGameId: z.string().nullable(),
  importAt: isoDateTime,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const libraryEntrySchema = z.strictObject({
  id: z.string(),
  gameId: z.string(),
  playState: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]),
  completedBefore: z.boolean(),
  isMainGame: z.boolean(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).nullable(),
  interest: z.number().int().nullable(),
  rating: z.number().int().nullable(),
  preferredEnvironment: z.enum(["LINUX", "STEAM_DECK", "WINDOWS"]).nullable(),
  gameExperience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable(),
  handheldSuitable: z.boolean().nullable(),
  compatOverrideStatus: z
    .enum(["READY", "READY_WITH_TINKERING", "FALLBACK_RECOMMENDED", "REQUIRED", "UNKNOWN"])
    .nullable(),
  compatOverrideReason: z.string().nullable(),
  playSoon: z.boolean(),
  replayCandidate: z.boolean(),
  hidden: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const availabilityRowSchema = z.strictObject({
  id: z.string(),
  gameId: z.string(),
  source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]),
  alternativeSourceId: z.string().nullable(),
  steamAppId: z.string().nullable(),
  steamPlaytimeTotal: z.string().nullable(),
  steamLastPlayed: isoDateTime.nullable(),
  addedAt: isoDateTime,
});

const externalIdSchema = z.strictObject({
  id: z.string(),
  namespaceId: z.string(),
  namespace: z.string(),
  externalId: z.string(),
  matchMethod: z.enum(["EXACT_STEAM_APP_ID", "MANUAL_IGDB_SEARCH", "MANUAL_ITAD_LOOKUP", "INFERRED"]),
  gameId: z.string(),
});

const alternativeSourceSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  knownKey: z.string().nullable(),
  archivedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const personalTagSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
}).superRefine((tag, ctx) => {
  if (tag.name.trim() !== tag.name || normalizePersonalTagName(tag.name) !== tag.normalizedName) {
    ctx.addIssue({ code: "custom", path: ["normalizedName"], message: "Tag identity does not match its display name" });
  }
});

const gameTagSchema = z.strictObject({
  gameId: z.string(),
  tagId: z.string(),
});

export const settingsSchema = appSettingsSchema;
export const gamesSchema = z.array(gameSchema);
export const libraryEntriesSchema = z.array(libraryEntrySchema);
export const availabilitySchema = z.array(availabilityRowSchema);
export const externalIdsSchema = z.array(externalIdSchema);
export const alternativeSourcesSchema = z.array(alternativeSourceSchema);
export const tagsSchema = z.array(personalTagSchema);
export const gameTagsSchema = z.array(gameTagSchema);

const wishlistEntrySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  type: z.enum(["BASE_GAME", "DLC"]),
  baseGameId: z.string().nullable(),
  interest: z.number().int().nullable(),
  gameExperience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable(),
  handheldSuitable: z.boolean().nullable(),
  targetPriceMxn: z.string().nullable(),
  steamAppId: z.string().nullable(),
  steamAppIdProvenance: z.enum(["STEAM_IMPORT", "USER", "IGDB_SUGGESTION"]).nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const unresolvedDlcRowSchema = z.strictObject({
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

const wishlistImportReviewSchema = z.strictObject({
  id: z.string(),
  steamAppId: z.string(),
  name: z.string(),
  candidates: z.unknown(),
  status: z.enum(["OPEN", "LINKED", "IGNORED"]),
  reviewedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const wishlistImportIgnoreSchema = z.strictObject({
  id: z.string(),
  steamAppId: z.string(),
  name: z.string(),
  createdAt: isoDateTime,
});

const possibleDuplicateSchema = z.strictObject({
  id: z.string(),
  gameAId: z.string(),
  gameBId: z.string(),
  evidence: z.unknown().nullable(),
  confidence: z.number().nullable(),
  status: z.enum(["OPEN", "DISMISSED"]),
  reviewedAt: isoDateTime.nullable(),
});

const recommendationRunSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(["PLAY_NEXT", "BUY"]),
  context: z.unknown().nullable(),
  createdAt: isoDateTime,
});

const recommendationItemSchema = z.strictObject({
  id: z.string(),
  runId: z.string(),
  gameId: z.string().nullable(),
  wishlistEntryId: z.string().nullable(),
  rank: z.number().int(),
  score: z.number(),
  positive: z.unknown().nullable(),
  negative: z.unknown().nullable(),
  caveats: z.unknown().nullable(),
  role: z.enum(["BEST_FIT_1", "BEST_FIT_2", "HANDHELD_PICK", "OUT_OF_THE_BOX", "CHANGE_OF_PACE", "DEAL"]).nullable(),
  createdAt: isoDateTime,
});

const recommendationFeedbackSchema = z.strictObject({
  id: z.string(),
  gameId: z.string().nullable(),
  wishlistEntryId: z.string().nullable(),
  kind: z.enum(["PLAY_NEXT", "BUY"]),
  createdAt: isoDateTime,
});

const recommendationEventSchema = z.strictObject({
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

const recommendationProfileSchema = z.strictObject({
  id: z.number().int(),
  version: z.number().int(),
  payload: z.unknown(),
  rebuiltAt: isoDateTime,
  updatedAt: isoDateTime,
});

const recommendationPreferenceSchema = z.strictObject({
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

const recommendationTuneStateSchema = z.strictObject({
  id: z.number().int(),
  playTune: z.unknown().nullable(),
  buyTune: z.unknown().nullable(),
  updatedAt: isoDateTime,
});

const recommendationPresetSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  tune: z.unknown(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const recommendationsObjectSchema = z.strictObject({
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

const exportDataSchema = <
  TSettings extends z.ZodTypeAny,
  TLibraryEntry extends z.ZodTypeAny,
>(settings: TSettings, libraryEntry: TLibraryEntry) => z.strictObject({
    settings: settings.nullable(),
    games: gamesSchema,
    libraryEntries: z.array(libraryEntry),
    availability: availabilitySchema,
    externalIds: externalIdsSchema,
    alternativeSources: alternativeSourcesSchema,
    tags: tagsSchema,
    gameTags: gameTagsSchema,
    wishlist: wishlistSchema,
    unresolvedDlc: unresolvedDlcSchema,
    wishlistImportReviews: wishlistImportReviewsSchema,
    wishlistImportIgnores: wishlistImportIgnoresSchema,
    possibleDuplicates: possibleDuplicatesSchema,
    recommendations: recommendationsSchema,
  });

const currentExportDataSchema = exportDataSchema(appSettingsSchema, libraryEntrySchema);

export const exportDocumentSchema = z.strictObject({
  version: z.literal(EXPORT_VERSION),
  exportedAt: isoDateTime,
  data: currentExportDataSchema,
});

export type ExportDocument = z.infer<typeof exportDocumentSchema>;

export { EXPORT_VERSION };
