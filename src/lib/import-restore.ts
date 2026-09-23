function reviveRow(row: Record<string, unknown>, dateFields: readonly string[]): Record<string, unknown> {
  const revived: Record<string, unknown> = { ...row };
  for (const field of dateFields) {
    if (revived[field] != null && typeof revived[field] === "string") {
      revived[field] = new Date(revived[field] as string);
    }
  }
  return revived;
}

export function reviveRows(
  rows: readonly Record<string, unknown>[],
  dateFields: readonly string[],
): Record<string, unknown>[] {
  return rows.map((row) => reviveRow(row, dateFields));
}

export interface ImportDb {
  appSettings: { count: () => Promise<number> };
  game: { count: () => Promise<number> };
  libraryEntry: { count: () => Promise<number> };
  gameAvailability: { count: () => Promise<number> };
  externalGameId: { count: () => Promise<number> };
  alternativeSource: { count: () => Promise<number> };
  personalTag: { count: () => Promise<number> };
  gameTag: { count: () => Promise<number> };
  wishlistEntry: { count: () => Promise<number> };
  unresolvedSteamDlc: { count: () => Promise<number> };
  wishlistImportReview: { count: () => Promise<number> };
  wishlistImportIgnore: { count: () => Promise<number> };
  possibleDuplicate: { count: () => Promise<number> };
  recommendationRun: { count: () => Promise<number> };
  recommendationItem: { count: () => Promise<number> };
  recommendationFeedback: { count: () => Promise<number> };
  recommendationEvent: { count: () => Promise<number> };
  recommendationProfile: { count: () => Promise<number> };
  recommendationPreference: { count: () => Promise<number> };
  recommendationTuneState: { count: () => Promise<number> };
  recommendationPreset: { count: () => Promise<number> };
}

const BLOCKING_MODEL_TO_DOMAIN: Array<[keyof ImportDb, string]> = [
  ["game", "games"],
  ["wishlistEntry", "wishlist"],
];

export async function assertEmptySchema(db: ImportDb): Promise<{ empty: boolean; nonEmpty: string[] }> {
  const counts = await Promise.all(BLOCKING_MODEL_TO_DOMAIN.map(([model]) => db[model].count()));
  const nonEmpty = BLOCKING_MODEL_TO_DOMAIN.flatMap(([, domain], index) =>
    counts[index] > 0 ? [domain] : [],
  ).filter((domain, index, all) => all.indexOf(domain) === index);
  return { empty: nonEmpty.length === 0, nonEmpty };
}

const DATE_FIELDS = {
  appSettings: ["createdAt", "updatedAt"],
  games: ["importAt", "createdAt", "updatedAt"],
  libraryEntries: ["createdAt", "updatedAt"],
  availability: ["steamLastPlayed", "addedAt"],
  externalIds: [],
  alternativeSources: ["archivedAt", "createdAt", "updatedAt"],
  tags: [],
  gameTags: [],
  wishlist: ["createdAt", "updatedAt"],
  unresolvedDlc: ["discardedAt", "createdAt", "updatedAt"],
  wishlistImportReviews: ["reviewedAt", "createdAt", "updatedAt"],
  wishlistImportIgnores: ["createdAt"],
  possibleDuplicates: ["reviewedAt"],
  recommendationRuns: ["createdAt"],
  recommendationItems: ["createdAt"],
  recommendationFeedback: ["createdAt"],
  recommendationEvents: ["createdAt"],
  recommendationProfile: ["rebuiltAt", "updatedAt"],
  recommendationPreferences: ["createdAt", "updatedAt"],
  recommendationTuneState: ["updatedAt"],
  recommendationPresets: ["createdAt", "updatedAt"],
} as const;

interface ImportTxModel {
  createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
  deleteMany: () => Promise<{ count: number }>;
}

export interface TxDb {
  appSettings: ImportTxModel;
  game: ImportTxModel;
  libraryEntry: ImportTxModel;
  gameAvailability: ImportTxModel;
  externalGameId: ImportTxModel;
  alternativeSource: ImportTxModel;
  personalTag: ImportTxModel;
  gameTag: ImportTxModel;
  wishlistEntry: ImportTxModel;
  unresolvedSteamDlc: ImportTxModel;
  wishlistImportReview: ImportTxModel;
  wishlistImportIgnore: ImportTxModel;
  possibleDuplicate: ImportTxModel;
  recommendationRun: ImportTxModel;
  recommendationItem: ImportTxModel;
  recommendationFeedback: ImportTxModel;
  recommendationEvent: ImportTxModel;
  recommendationProfile: ImportTxModel;
  recommendationPreference: ImportTxModel;
  recommendationTuneState: ImportTxModel;
  recommendationPreset: ImportTxModel;
}

const CLEAR_ORDER: Array<keyof TxDb> = [
  "recommendationItem",
  "recommendationEvent",
  "recommendationRun",
  "recommendationFeedback",
  "recommendationProfile",
  "recommendationPreference",
  "recommendationTuneState",
  "recommendationPreset",
  "possibleDuplicate",
  "gameTag",
  "libraryEntry",
  "gameAvailability",
  "externalGameId",
  "wishlistEntry",
  "unresolvedSteamDlc",
  "wishlistImportReview",
  "wishlistImportIgnore",
  "game",
  "alternativeSource",
  "personalTag",
  "appSettings",
];

export async function clearExistingExportData(db: TxDb): Promise<void> {
  for (const model of CLEAR_ORDER) {
    await db[model].deleteMany();
  }
}

import type { ExportDocument } from "./export-schema";

export interface RestoreCounts {
  settings: number;
  games: number;
  libraryEntries: number;
  availability: number;
  externalIds: number;
  alternativeSources: number;
  tags: number;
  gameTags: number;
  wishlist: number;
  unresolvedDlc: number;
  wishlistImportReviews: number;
  wishlistImportIgnores: number;
  possibleDuplicates: number;
  recommendationRuns: number;
  recommendationItems: number;
  recommendationFeedback: number;
  recommendationEvents: number;
  recommendationProfile: number;
  recommendationPreferences: number;
  recommendationTuneState: number;
  recommendationPresets: number;
}

export async function restoreExportDocument(db: TxDb, document: ExportDocument): Promise<RestoreCounts> {
  const { data } = document;
  const baseGames = data.games.filter((game) => game.baseGameId === null);
  const dlcs = data.games.filter((game) => game.baseGameId !== null);
  const restored: RestoreCounts = {
    settings: 0,
    games: 0,
    libraryEntries: 0,
    availability: 0,
    externalIds: 0,
    alternativeSources: 0,
    tags: 0,
    gameTags: 0,
    wishlist: 0,
    unresolvedDlc: 0,
    wishlistImportReviews: 0,
    wishlistImportIgnores: 0,
    possibleDuplicates: 0,
    recommendationRuns: 0,
    recommendationItems: 0,
    recommendationFeedback: 0,
    recommendationEvents: 0,
    recommendationProfile: 0,
    recommendationPreferences: 0,
    recommendationTuneState: 0,
    recommendationPresets: 0,
  };

  if (data.settings) {
    await db.appSettings.createMany({ data: reviveRows([data.settings], DATE_FIELDS.appSettings) });
    restored.settings = 1;
  }

  if (baseGames.length > 0) {
    await db.game.createMany({ data: reviveRows(baseGames, DATE_FIELDS.games) });
  }
  if (dlcs.length > 0) {
    await db.game.createMany({ data: reviveRows(dlcs, DATE_FIELDS.games) });
  }
  restored.games = baseGames.length + dlcs.length;

  if (data.alternativeSources.length > 0) {
    await db.alternativeSource.createMany({
      data: reviveRows(data.alternativeSources, DATE_FIELDS.alternativeSources),
    });
  }
  restored.alternativeSources = data.alternativeSources.length;

  if (data.tags.length > 0) {
    await db.personalTag.createMany({ data: reviveRows(data.tags, DATE_FIELDS.tags) });
  }
  restored.tags = data.tags.length;

  const dlcGameIds = new Set(
    data.games
      .filter((game) => game.type === "DLC" || game.baseGameId !== null)
      .map((game) => game.id),
  );
  const libraryEntries = data.libraryEntries.filter((entry) => !dlcGameIds.has(entry.gameId));
  if (libraryEntries.length > 0) {
    await db.libraryEntry.createMany({
      data: reviveRows(libraryEntries, DATE_FIELDS.libraryEntries).map((entry) => ({
        ...entry,
        handheldSuitable: entry.handheldSuitable ?? null,
      })),
    });
  }
  restored.libraryEntries = libraryEntries.length;
  if (data.externalIds.length > 0) {
    await db.externalGameId.createMany({ data: reviveRows(data.externalIds, DATE_FIELDS.externalIds) });
  }
  restored.externalIds = data.externalIds.length;
  if (data.availability.length > 0) {
    await db.gameAvailability.createMany({
      data: reviveRows(data.availability, DATE_FIELDS.availability),
    });
  }
  restored.availability = data.availability.length;
  if (data.gameTags.length > 0) {
    await db.gameTag.createMany({ data: reviveRows(data.gameTags, DATE_FIELDS.gameTags) });
  }
  restored.gameTags = data.gameTags.length;

  if (data.wishlist.length > 0) {
    await db.wishlistEntry.createMany({
      data: reviveRows(data.wishlist, DATE_FIELDS.wishlist).map((entry) => ({
        ...entry,
        handheldSuitable: entry.handheldSuitable ?? null,
      })),
    });
  }
  restored.wishlist = data.wishlist.length;

  if (data.unresolvedDlc.length > 0) {
    await db.unresolvedSteamDlc.createMany({
      data: reviveRows(data.unresolvedDlc, DATE_FIELDS.unresolvedDlc),
    });
  }
  restored.unresolvedDlc = data.unresolvedDlc.length;
  if (data.wishlistImportReviews.length > 0) {
    await db.wishlistImportReview.createMany({
      data: reviveRows(data.wishlistImportReviews, DATE_FIELDS.wishlistImportReviews),
    });
  }
  restored.wishlistImportReviews = data.wishlistImportReviews.length;
  if (data.wishlistImportIgnores.length > 0) {
    await db.wishlistImportIgnore.createMany({
      data: reviveRows(data.wishlistImportIgnores, DATE_FIELDS.wishlistImportIgnores),
    });
  }
  restored.wishlistImportIgnores = data.wishlistImportIgnores.length;
  if (data.possibleDuplicates.length > 0) {
    await db.possibleDuplicate.createMany({
      data: reviveRows(data.possibleDuplicates, DATE_FIELDS.possibleDuplicates),
    });
  }
  restored.possibleDuplicates = data.possibleDuplicates.length;

  if (data.recommendations.runs.length > 0) {
    await db.recommendationRun.createMany({
      data: reviveRows(data.recommendations.runs, DATE_FIELDS.recommendationRuns),
    });
  }
  restored.recommendationRuns = data.recommendations.runs.length;
  if (data.recommendations.items.length > 0) {
    await db.recommendationItem.createMany({
      data: reviveRows(data.recommendations.items, DATE_FIELDS.recommendationItems),
    });
  }
  restored.recommendationItems = data.recommendations.items.length;
  if (data.recommendations.feedback.length > 0) {
    await db.recommendationFeedback.createMany({
      data: reviveRows(data.recommendations.feedback, DATE_FIELDS.recommendationFeedback),
    });
  }
  restored.recommendationFeedback = data.recommendations.feedback.length;
  if (data.recommendations.events.length > 0) {
    await db.recommendationEvent.createMany({
      data: reviveRows(data.recommendations.events, DATE_FIELDS.recommendationEvents),
    });
  }
  restored.recommendationEvents = data.recommendations.events.length;

  if (data.recommendations.profile) {
    await db.recommendationProfile.createMany({
      data: reviveRows([data.recommendations.profile], DATE_FIELDS.recommendationProfile),
    });
    restored.recommendationProfile = 1;
  }
  if (data.recommendations.preferences.length > 0) {
    await db.recommendationPreference.createMany({
      data: reviveRows(data.recommendations.preferences, DATE_FIELDS.recommendationPreferences),
    });
  }
  restored.recommendationPreferences = data.recommendations.preferences.length;
  if (data.recommendations.tuneState) {
    await db.recommendationTuneState.createMany({
      data: reviveRows([data.recommendations.tuneState], DATE_FIELDS.recommendationTuneState),
    });
    restored.recommendationTuneState = 1;
  }
  if (data.recommendations.presets.length > 0) {
    await db.recommendationPreset.createMany({
      data: reviveRows(data.recommendations.presets, DATE_FIELDS.recommendationPresets),
    });
  }
  restored.recommendationPresets = data.recommendations.presets.length;

  return restored;
}
