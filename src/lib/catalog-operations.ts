import type { CatalogOperationState } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { CATALOG_OPERATION_TTL_MS } from "@/lib/catalog-operation-constants";

export { CATALOG_OPERATION_TTL_MS } from "@/lib/catalog-operation-constants";
export const SNAPSHOT_VERSION = 1 as const;

export const SNAPSHOT_MODELS = [
  "Game",
  "LibraryEntry",
  "ExternalGameId",
  "GameAvailability",
  "CollectionMembership",
  "GameTag",
  "MetadataSnapshot",
  "WishlistEntry",
  "DealOffer",
  "PriceRefresh",
  "CompatibilitySnapshot",
  "EnvironmentCompatibility",
  "PossibleDuplicate",
] as const;

export type SnapshotModel = (typeof SNAPSHOT_MODELS)[number];

export type CatalogOperationKind = "MERGE" | "DELETE";

export interface CatalogOperationSnapshotEnvelope<T> {
  version: typeof SNAPSHOT_VERSION;
  createdAt: string;
  type: CatalogOperationKind;
  payload: T;
}

export interface OperationTimeState {
  state: CatalogOperationState;
  expiresAt: Date;
}

export interface OperationUserClient {
  user: {
    findUnique: (args: {
      where: { email: string };
    }) => Promise<{ id: string; email: string | null } | null>;
    create: (args: { data: { email: string } }) => Promise<{ id: string }>;
  };
}

export function createSnapshotEnvelope<T>(
  payload: T,
  operationType: CatalogOperationKind,
  now = new Date(),
): CatalogOperationSnapshotEnvelope<T> {
  return {
    version: SNAPSHOT_VERSION,
    createdAt: now.toISOString(),
    type: operationType,
    payload,
  };
}

export function parseSnapshotEnvelope<T>(
  value: unknown,
): CatalogOperationSnapshotEnvelope<T> | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<CatalogOperationSnapshotEnvelope<T>>;
  if (candidate.version !== SNAPSHOT_VERSION) return null;
  if (candidate.type !== "MERGE" && candidate.type !== "DELETE") return null;
  if (typeof candidate.createdAt !== "string") return null;
  if (!("payload" in candidate)) return null;
  return candidate as CatalogOperationSnapshotEnvelope<T>;
}

export function operationExpiry(
  now = new Date(),
  ttlMs = CATALOG_OPERATION_TTL_MS,
): Date {
  return new Date(now.getTime() + ttlMs);
}

export function isOperationExpired(
  expiresAt: Date,
  now = new Date(),
): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function isTerminalState(state: CatalogOperationState): boolean {
  return state === "UNDONE" || state === "EXPIRED" || state === "COMPLETED";
}

export function isUndoable(
  operation: OperationTimeState,
  now = new Date(),
): boolean {
  return (
    operation.state === "PENDING" && !isOperationExpired(operation.expiresAt, now)
  );
}

export function gameIdsOverlap(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const present = new Set(b);
  return a.some((id) => present.has(id));
}

export function uniqueGameIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export async function resolveOperationUser(
  email: string | null | undefined,
  client: OperationUserClient = prisma,
): Promise<{ id: string } | null> {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const existing = await client.user.findUnique({
    where: { email: trimmed },
  });
  if (existing) return { id: existing.id };

  return client.user.create({ data: { email: trimmed } });
}

export type PersonalFieldName =
  | "playState"
  | "isMainGame"
  | "priority"
  | "interest"
  | "rating"
  | "preferredEnvironment"
  | "compatOverrideStatus"
  | "compatOverrideReason"
  | "playSoon"
  | "replayCandidate"
  | "hidden"
  | "notes";

export const PERSONAL_FIELDS: readonly PersonalFieldName[] = [
  "playState",
  "isMainGame",
  "priority",
  "interest",
  "rating",
  "preferredEnvironment",
  "compatOverrideStatus",
  "compatOverrideReason",
  "playSoon",
  "replayCandidate",
  "hidden",
  "notes",
];

export type MergeSourceLibraryEntry = {
  playState: string | null;
  isMainGame: boolean | null;
  priority: string | null;
  interest: number | null;
  rating: number | null;
  preferredEnvironment: string | null;
  compatOverrideStatus: string | null;
  compatOverrideReason: string | null;
  playSoon: boolean | null;
  replayCandidate: boolean | null;
  hidden: boolean | null;
  notes: string | null;
}

export interface PersonalValueConflict {
  field: PersonalFieldName;
  a: { gameId: string; value: unknown };
  b: { gameId: string; value: unknown };
}

export interface MergeSourceExternalId {
  id: string;
  namespace: string;
  externalId: string;
  gameId: string;
}

export interface ExternalIdConflict {
  namespace: string;
  rows: { id: string; externalId: string; gameId: string }[];
}

export interface OneToOneConflict {
  kind: "wishlist" | "compatibility" | "environment";
  key: string;
  a: { gameId: string; rowId: string };
  b: { gameId: string; rowId: string };
}

export interface MergeSourceGame {
  id: string;
  name: string;
  origin: string;
  libraryEntry: MergeSourceLibraryEntry | null;
  externalIds: MergeSourceExternalId[];
  dlc: { id: string; name: string }[];
  availability: { id: string; source: string; steamAppId: string | null }[];
  collections: { collectionId: string }[];
  tags: { tagId: string }[];
  metadataSnapshots: { id: string; provider: string }[];
  wishlistRowId: string | null;
  compatSnapshots: { id: string; provider: string }[];
  envCompat: { id: string; environment: string }[];
}

export interface MergeGameSummary {
  id: string;
  name: string;
  origin: string;
  dlcCount: number;
}

export interface MergeProposal {
  duplicateId: string;
  games: [MergeGameSummary, MergeGameSummary];
  survivorId: string;
  discardedId: string;
  finalName: string;
  blocked: boolean;
  library: {
    defaults: Partial<Record<PersonalFieldName, unknown>>;
    conflicts: PersonalValueConflict[];
  };
  externalIds: {
    union: { id: string; namespace: string; externalId: string }[];
    conflicts: ExternalIdConflict[];
  };
  oneToOne: OneToOneConflict[];
  relations: {
    availability: number;
    collections: number;
    tags: number;
    metadataSnapshots: number;
  };
}

export function suggestSurvivor(
  a: Pick<MergeSourceGame, "id" | "origin">,
  b: Pick<MergeSourceGame, "id" | "origin">,
): string {
  const aSteam = a.origin === "STEAM_IMPORT";
  const bSteam = b.origin === "STEAM_IMPORT";
  if (aSteam !== bSteam) return aSteam ? a.id : b.id;
  return a.id < b.id ? a.id : b.id;
}

function resolvePersonalValue<T>(
  field: PersonalFieldName,
  aValue: T | null | undefined,
  bValue: T | null | undefined,
  gameAId: string,
  gameBId: string,
): { default: T | null } | { conflict: PersonalValueConflict } {
  if (aValue === null || aValue === undefined) {
    if (bValue === null || bValue === undefined) return { default: null };
    return { default: bValue };
  }
  if (bValue === null || bValue === undefined) return { default: aValue };
  if (aValue === bValue) return { default: aValue };
  return {
    conflict: {
      field,
      a: { gameId: gameAId, value: aValue },
      b: { gameId: gameBId, value: bValue },
    },
  };
}

export function resolvePersonalFields(
  entryA: MergeSourceLibraryEntry | null,
  entryB: MergeSourceLibraryEntry | null,
  gameAId: string,
  gameBId: string,
): MergeProposal["library"] {
  const defaults: Partial<Record<PersonalFieldName, unknown>> = {};
  const conflicts: PersonalValueConflict[] = [];

  for (const field of PERSONAL_FIELDS) {
    const resolved = resolvePersonalValue(
      field,
      entryA?.[field] ?? null,
      entryB?.[field] ?? null,
      gameAId,
      gameBId,
    );
    if ("conflict" in resolved) {
      conflicts.push(resolved.conflict);
    } else {
      defaults[field] = resolved.default;
    }
  }

  return { defaults, conflicts };
}

export function planExternalIdUnion(
  a: MergeSourceExternalId[],
  b: MergeSourceExternalId[],
): MergeProposal["externalIds"] {
  const byNamespace = new Map<string, MergeSourceExternalId[]>();
  for (const row of [...a, ...b]) {
    const group = byNamespace.get(row.namespace) ?? [];
    group.push(row);
    byNamespace.set(row.namespace, group);
  }

  const union: { id: string; namespace: string; externalId: string }[] = [];
  const conflicts: ExternalIdConflict[] = [];

  for (const [namespace, rows] of byNamespace) {
    const uniqueIds = new Set(rows.map((row) => row.externalId));
    if (uniqueIds.size > 1) {
      conflicts.push({
        namespace,
        rows: rows.map(({ id, externalId, gameId }) => ({ id, externalId, gameId })),
      });
      continue;
    }
    const keeper = rows[0];
    union.push({ id: keeper.id, namespace, externalId: keeper.externalId });
  }

  return { union, conflicts };
}

export function planOneToOneConflicts(
  a: {
    gameId: string;
    wishlistRowId: string | null;
    compatSnapshots: { id: string; provider: string }[];
    envCompat: { id: string; environment: string }[];
  },
  b: {
    gameId: string;
    wishlistRowId: string | null;
    compatSnapshots: { id: string; provider: string }[];
    envCompat: { id: string; environment: string }[];
  },
): OneToOneConflict[] {
  const conflicts: OneToOneConflict[] = [];

  if (a.wishlistRowId && b.wishlistRowId) {
    conflicts.push({
      kind: "wishlist",
      key: "wishlist",
      a: { gameId: a.gameId, rowId: a.wishlistRowId },
      b: { gameId: b.gameId, rowId: b.wishlistRowId },
    });
  }

  const providers = new Set([
    ...a.compatSnapshots.map((row) => row.provider),
    ...b.compatSnapshots.map((row) => row.provider),
  ]);
  for (const provider of providers) {
    const aRow = a.compatSnapshots.find((row) => row.provider === provider);
    const bRow = b.compatSnapshots.find((row) => row.provider === provider);
    if (aRow && bRow) {
      conflicts.push({
        kind: "compatibility",
        key: provider,
        a: { gameId: a.gameId, rowId: aRow.id },
        b: { gameId: b.gameId, rowId: bRow.id },
      });
    }
  }

  const environments = new Set([
    ...a.envCompat.map((row) => row.environment),
    ...b.envCompat.map((row) => row.environment),
  ]);
  for (const environment of environments) {
    const aRow = a.envCompat.find((row) => row.environment === environment);
    const bRow = b.envCompat.find((row) => row.environment === environment);
    if (aRow && bRow) {
      conflicts.push({
        kind: "environment",
        key: environment,
        a: { gameId: a.gameId, rowId: aRow.id },
        b: { gameId: b.gameId, rowId: bRow.id },
      });
    }
  }

  return conflicts;
}

function countUnique<T>(rows: T[], key: (row: T) => string): number {
  return new Set(rows.map(key)).size;
}

export function buildMergeProposal(input: {
  duplicateId: string;
  gameA: MergeSourceGame;
  gameB: MergeSourceGame;
}): MergeProposal {
  const { duplicateId, gameA, gameB } = input;
  const survivorId = suggestSurvivor(gameA, gameB);
  const discardedId = survivorId === gameA.id ? gameB.id : gameA.id;
  const survivor = survivorId === gameA.id ? gameA : gameB;

  const library = resolvePersonalFields(gameA.libraryEntry, gameB.libraryEntry, gameA.id, gameB.id);
  const externalIds = planExternalIdUnion(gameA.externalIds, gameB.externalIds);
  const oneToOne = planOneToOneConflicts(
    {
      gameId: gameA.id,
      wishlistRowId: gameA.wishlistRowId,
      compatSnapshots: gameA.compatSnapshots,
      envCompat: gameA.envCompat,
    },
    {
      gameId: gameB.id,
      wishlistRowId: gameB.wishlistRowId,
      compatSnapshots: gameB.compatSnapshots,
      envCompat: gameB.envCompat,
    },
  );

  return {
    duplicateId,
    games: [
      { id: gameA.id, name: gameA.name, origin: gameA.origin, dlcCount: gameA.dlc.length },
      { id: gameB.id, name: gameB.name, origin: gameB.origin, dlcCount: gameB.dlc.length },
    ],
    survivorId,
    discardedId,
    finalName: survivor.name,
    blocked:
      library.conflicts.length > 0 ||
      externalIds.conflicts.length > 0 ||
      oneToOne.length > 0,
    library,
    externalIds,
    oneToOne,
    relations: {
      availability: countUnique(
        [...gameA.availability, ...gameB.availability],
        (row) =>
          row.source === "STEAM" && row.steamAppId ? `steam:${row.steamAppId}` : row.id,
      ),
      collections: countUnique(
        [...gameA.collections, ...gameB.collections],
        (row) => row.collectionId,
      ),
      tags: countUnique(
        [...gameA.tags, ...gameB.tags],
        (row) => row.tagId,
      ),
      metadataSnapshots: countUnique(
        [...gameA.metadataSnapshots, ...gameB.metadataSnapshots],
        (row) => row.provider,
      ),
    },
  };
}

function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    return (value as { toString(): string }).toString();
  }
  return value;
}

function rowToJsonSafe(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, toJsonSafe(value)]),
  );
}

export interface MergeSnapshotRecord {
  model: SnapshotModel;
  action: "update" | "delete";
  row: Record<string, unknown>;
}

export interface MergeSnapshotPayload {
  survivorId: string;
  discardedId: string;
  records: MergeSnapshotRecord[];
}

export interface DeleteSnapshotPayload {
  gameId: string;
  records: MergeSnapshotRecord[];
}

export interface DeleteSnapshotPlan {
  affectedGameIds: string[];
  snapshot: DeleteSnapshotPayload;
}

function gameScalarRow(game: MergeGraphGame): Record<string, unknown> {
  return {
    id: game.id,
    name: game.name,
    origin: game.origin,
    type: game.type,
    baseGameId: game.baseGameId,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    importAt: game.importAt,
  };
}

function pushWishlistDeletes(
  pushDelete: (model: SnapshotModel, row: Record<string, unknown>) => void,
  wishlist: MergeGraphGame["wishlistEntry"],
) {
  if (!wishlist) return;
  const { offers = [], refreshes = [], ...row } = wishlist;
  pushDelete("WishlistEntry", row);
  for (const offer of offers) pushDelete("DealOffer", offer);
  for (const refresh of refreshes) pushDelete("PriceRefresh", refresh);
}

export function buildDeleteSnapshotPlan(
  game: MergeGraphGame,
  descendants: MergeGraphGame[],
): DeleteSnapshotPlan {
  const records: MergeSnapshotRecord[] = [];
  const pushDelete = (model: SnapshotModel, row: Record<string, unknown>) => {
    records.push({ model, action: "delete", row: rowToJsonSafe(row) });
  };

  const collect = (node: MergeGraphGame) => {
    pushDelete("Game", gameScalarRow(node));
    if (node.libraryEntry) pushDelete("LibraryEntry", node.libraryEntry);
    for (const row of node.externalIds) pushDelete("ExternalGameId", row);
    for (const row of node.availability) pushDelete("GameAvailability", row);
    for (const row of node.collections) pushDelete("CollectionMembership", row);
    for (const row of node.tags) pushDelete("GameTag", row);
    for (const row of node.metadataSnapshots) pushDelete("MetadataSnapshot", row);
    pushWishlistDeletes(pushDelete, node.wishlistEntry);
    for (const row of node.compatSnapshots) pushDelete("CompatibilitySnapshot", row);
    for (const row of node.envCompat) pushDelete("EnvironmentCompatibility", row);
    for (const row of node.duplicatesA) pushDelete("PossibleDuplicate", row);
    for (const row of node.duplicatesB) pushDelete("PossibleDuplicate", row);
  };

  collect(game);
  for (const descendant of descendants) collect(descendant);

  return {
    affectedGameIds: [...new Set([game.id, ...descendants.map((row) => row.id)])],
    snapshot: { gameId: game.id, records },
  };
}

export interface MergeExecutionChoices {
  survivorId: string;
  finalName: string;
  personal: Partial<
    Record<PersonalFieldName, { side: "a" | "b" } | { value: unknown }>
  >;
  externalIds: Partial<Record<string, { rowId: string }>>;
  oneToOne: Partial<Record<string, { side: "a" | "b" }>>;
}

export interface ResolvedMergePlan {
  survivorId: string;
  discardedId: string;
  finalName: string;
  personalValues: Partial<Record<PersonalFieldName, unknown>>;
  externalKeep: { namespace: string; rowId: string }[];
  externalDeleteRowIds: string[];
  oneToOneKeep: Record<string, "a" | "b">;
}

export type ResolveMergeResult =
  | { ok: true; plan: ResolvedMergePlan }
  | { ok: false; message: string };

/** @returns true when the value is a plain object (not null, array, or date) */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveMergePlan(
  proposal: MergeProposal,
  choices: MergeExecutionChoices,
): ResolveMergeResult {
  const gameIds = new Set(proposal.games.map((game) => game.id));
  if (!gameIds.has(choices.survivorId)) {
    return { ok: false, message: "Chosen survivor is not part of this duplicate pair" };
  }
  const finalName = choices.finalName.trim();
  if (!finalName) {
    return { ok: false, message: "Final name is required" };
  }

  const personalValues: Partial<Record<PersonalFieldName, unknown>> = {
    ...proposal.library.defaults,
  };
  for (const conflict of proposal.library.conflicts) {
    const choice = choices.personal?.[conflict.field];
    if (!isPlainObject(choice)) {
      return { ok: false, message: `Merge blocked: choose a value for "${conflict.field}"` };
    }
    if ("side" in choice && (choice.side === "a" || choice.side === "b")) {
      const side = choice.side;
      personalValues[conflict.field] = (side === "a" ? conflict.a : conflict.b).value;
    } else if ("value" in choice) {
      personalValues[conflict.field] = choice.value;
    } else {
      return { ok: false, message: `Merge blocked: choose a value for "${conflict.field}"` };
    }
  }

  const externalKeep: { namespace: string; rowId: string }[] = proposal.externalIds.union.map(
    (row) => ({ namespace: row.namespace, rowId: row.id }),
  );
  const externalDeleteRowIds: string[] = [];
  for (const conflict of proposal.externalIds.conflicts) {
    const choice = choices.externalIds?.[conflict.namespace];
    if (!isPlainObject(choice) || typeof choice.rowId !== "string") {
      return {
        ok: false,
        message: `Merge blocked: choose an external ID for "${conflict.namespace}"`,
      };
    }
    const chosen = conflict.rows.find((row) => row.id === choice.rowId);
    if (!chosen) {
      return {
        ok: false,
        message: `Merge blocked: selected external ID is not valid for "${conflict.namespace}"`,
      };
    }
    externalKeep.push({ namespace: conflict.namespace, rowId: chosen.id });
    for (const row of conflict.rows) {
      if (row.id !== chosen.id) externalDeleteRowIds.push(row.id);
    }
  }

  const oneToOneKeep: Record<string, "a" | "b"> = {};
  for (const conflict of proposal.oneToOne) {
    const choice = choices.oneToOne?.[conflict.key];
    if (!isPlainObject(choice) || (choice.side !== "a" && choice.side !== "b")) {
      return { ok: false, message: `Merge blocked: choose a side for "${conflict.key}"` };
    }
    oneToOneKeep[conflict.key] = choice.side;
  }

  const discardedId = proposal.games.find((game) => game.id !== choices.survivorId)?.id;
  if (!discardedId) {
    return { ok: false, message: "Chosen survivor is not part of this duplicate pair" };
  }

  return {
    ok: true,
    plan: {
      survivorId: choices.survivorId,
      discardedId,
      finalName,
      personalValues,
      externalKeep,
      externalDeleteRowIds,
      oneToOneKeep,
    },
  };
}

export type OriginString = string;

export interface MergeGraphGame {
  id: string;
  name: string;
  origin: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  importAt: Date;
  baseGameId: string | null;
  libraryEntry: ({ id: string } & MergeSourceLibraryEntry) | null;
  externalIds: {
    id: string;
    gameId: string;
    namespace: string;
    externalId: string;
  }[];
  dlcs: ({ id: string; baseGameId: string | null } & Record<string, unknown>)[];
  availability: {
    id: string;
    gameId: string;
    source: string;
    steamAppId: string | null;
    steamPlaytimeTotal: bigint | null;
    steamLastPlayed: Date | null;
  }[];
  collections: { collectionId: string; gameId: string }[];
  tags: { tagId: string; gameId: string }[];
  metadataSnapshots: {
    id: string;
    gameId: string;
    provider: string;
    fetchedAt: Date;
  }[];
  wishlistEntry: {
    id: string;
    gameId: string;
    offers?: Record<string, unknown>[];
    refreshes?: Record<string, unknown>[];
  } | null;
  compatSnapshots: { id: string; gameId: string; provider: string }[];
  envCompat: { id: string; gameId: string; environment: string }[];
  duplicatesA: { id: string; gameBId: string; status: string }[];
  duplicatesB: { id: string; gameAId: string; status: string }[];
}

export interface MoveDirective {
  id: string;
  row: Record<string, unknown>;
}

export interface JoinMoveDirective {
  key: string;
  row: Record<string, unknown>;
}

export interface MergeMutationPlan {
  survivorId: string;
  discardedId: string;
  finalName: string;
  libraryEntry:
    | { rowId: string; original: Record<string, unknown>; data: Record<string, unknown> }
    | null;
  externalIdMoves: MoveDirective[];
  externalIdDeletes: MoveDirective[];
  availabilityMoves: MoveDirective[];
  availabilityDeletes: MoveDirective[];
  availabilityMerges: {
    rowId: string;
    original: Record<string, unknown>;
    data: Record<string, unknown>;
  }[];
  collectionMoves: JoinMoveDirective[];
  collectionDeletes: JoinMoveDirective[];
  tagMoves: JoinMoveDirective[];
  tagDeletes: JoinMoveDirective[];
  metadataMoves: MoveDirective[];
  metadataDeletes: MoveDirective[];
  wishlistMoves: MoveDirective[];
  wishlistDeletes: MoveDirective[];
  compatMoves: MoveDirective[];
  compatDeletes: MoveDirective[];
  envMoves: MoveDirective[];
  envDeletes: MoveDirective[];
  dlcMoves: MoveDirective[];
  duplicateMoves: MoveDirective[];
  duplicateDeletes: MoveDirective[];
  discardedGame: MoveDirective;
  affectedGameIds: string[];
  snapshot: MergeSnapshotPayload;
}

type OneToOneRow = { id: string; gameId: string };

function orderedPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

function maxSteamValues(
  a: { steamPlaytimeTotal: bigint | null; steamLastPlayed: Date | null },
  b: { steamPlaytimeTotal: bigint | null; steamLastPlayed: Date | null },
): {
  steamPlaytimeTotal: bigint | null;
  steamLastPlayed: Date | null;
} {
  const zero = BigInt(0);
  const playtimeA = a.steamPlaytimeTotal ?? zero;
  const playtimeB = b.steamPlaytimeTotal ?? zero;
  const latestA = a.steamLastPlayed?.getTime() ?? 0;
  const latestB = b.steamLastPlayed?.getTime() ?? 0;
  return {
    steamPlaytimeTotal: playtimeA >= playtimeB ? a.steamPlaytimeTotal : b.steamPlaytimeTotal,
    steamLastPlayed: latestA >= latestB ? a.steamLastPlayed : b.steamLastPlayed,
  };
}

export function planMergeMutations(input: {
  gameA: MergeGraphGame;
  gameB: MergeGraphGame;
  plan: ResolvedMergePlan;
}): MergeMutationPlan {
  const { gameA, gameB, plan } = input;
  const survivor = plan.survivorId === gameA.id ? gameA : gameB;
  const discarded = plan.survivorId === gameA.id ? gameB : gameA;
  const records: MergeSnapshotRecord[] = [];

  const snapshotWishlist = (action: "update" | "delete", row: Record<string, unknown>) => {
    const { offers, refreshes, ...clean } = row;
    records.push({ model: "WishlistEntry", action, row: rowToJsonSafe(clean) });
    if (action !== "delete") return;
    for (const offer of Array.isArray(offers) ? offers : []) {
      records.push({
        model: "DealOffer",
        action,
        row: rowToJsonSafe(offer as Record<string, unknown>),
      });
    }
    for (const refresh of Array.isArray(refreshes) ? refreshes : []) {
      records.push({
        model: "PriceRefresh",
        action,
        row: rowToJsonSafe(refresh as Record<string, unknown>),
      });
    }
  };

  const pushMove = (model: SnapshotModel, row: Record<string, unknown>) => {
    if (model === "WishlistEntry") {
      snapshotWishlist("update", row);
      return;
    }
    records.push({ model, action: "update", row: rowToJsonSafe(row) });
  };
  const pushDelete = (model: SnapshotModel, row: Record<string, unknown>) => {
    if (model === "WishlistEntry") {
      snapshotWishlist("delete", row);
      return;
    }
    records.push({ model, action: "delete", row: rowToJsonSafe(row) });
  };

  const libraryEntry = survivor.libraryEntry
    ? {
        rowId: survivor.libraryEntry.id,
        original: survivor.libraryEntry,
        data: plan.personalValues as Record<string, unknown>,
      }
    : null;
  if (libraryEntry) pushMove("LibraryEntry", libraryEntry.original);

  const externalIdMoves: MoveDirective[] = [];
  const externalIdDeletes: MoveDirective[] = [];
  const keepIds = new Set(plan.externalKeep.map((keep) => keep.rowId));
  const deleteIds = new Set(plan.externalDeleteRowIds);
  for (const row of [...gameA.externalIds, ...gameB.externalIds]) {
    if (deleteIds.has(row.id)) {
      externalIdDeletes.push({ id: row.id, row });
      pushDelete("ExternalGameId", row);
    } else if (keepIds.has(row.id)) {
      if (row.gameId === discarded.id) {
        externalIdMoves.push({ id: row.id, row });
        pushMove("ExternalGameId", row);
      }
    }
  }

  const availabilityMoves: MoveDirective[] = [];
  const availabilityDeletes: MoveDirective[] = [];
  const availabilityMerges: MergeMutationPlan["availabilityMerges"] = [];
  const steamById = new Map(
    survivor.availability
      .filter((row) => row.source === "STEAM" && row.steamAppId)
      .map((row) => [row.steamAppId as string, row]),
  );
  for (const row of discarded.availability) {
    const duplicate = row.source === "STEAM" && row.steamAppId ? steamById.get(row.steamAppId) : undefined;
    if (duplicate) {
      availabilityMerges.push({
        rowId: duplicate.id,
        original: { ...duplicate },
        data: maxSteamValues(duplicate, row) as Record<string, unknown>,
      });
      availabilityDeletes.push({ id: row.id, row });
      pushMove("GameAvailability", duplicate);
      pushDelete("GameAvailability", row);
    } else {
      availabilityMoves.push({ id: row.id, row });
      pushMove("GameAvailability", row);
    }
  }

  const collectionMoves: JoinMoveDirective[] = [];
  const collectionDeletes: JoinMoveDirective[] = [];
  const survivorCollections = new Set(survivor.collections.map((row) => row.collectionId));
  for (const row of discarded.collections) {
    if (survivorCollections.has(row.collectionId)) {
      collectionDeletes.push({ key: row.collectionId, row });
      pushDelete("CollectionMembership", row);
    } else {
      collectionMoves.push({ key: row.collectionId, row });
      pushMove("CollectionMembership", row);
    }
  }

  const tagMoves: JoinMoveDirective[] = [];
  const tagDeletes: JoinMoveDirective[] = [];
  const survivorTags = new Set(survivor.tags.map((row) => row.tagId));
  for (const row of discarded.tags) {
    if (survivorTags.has(row.tagId)) {
      tagDeletes.push({ key: row.tagId, row });
      pushDelete("GameTag", row);
    } else {
      tagMoves.push({ key: row.tagId, row });
      pushMove("GameTag", row);
    }
  }

  const metadataMoves: MoveDirective[] = [];
  const metadataDeletes: MoveDirective[] = [];
  const survivorMetadata = new Map(
    survivor.metadataSnapshots.map((row) => [row.provider, row]),
  );
  for (const row of discarded.metadataSnapshots) {
    const existing = survivorMetadata.get(row.provider);
    if (!existing) {
      metadataMoves.push({ id: row.id, row });
      pushMove("MetadataSnapshot", row);
      continue;
    }
    if (row.fetchedAt.getTime() > existing.fetchedAt.getTime()) {
      metadataMoves.push({ id: row.id, row });
      metadataDeletes.push({ id: existing.id, row: { ...existing } });
      pushMove("MetadataSnapshot", row);
      pushDelete("MetadataSnapshot", existing);
    } else {
      metadataDeletes.push({ id: row.id, row });
      pushDelete("MetadataSnapshot", row);
    }
  }

  const resolveOneToOne = (
    key: string,
    survivorRow: OneToOneRow | null,
    discardedRow: OneToOneRow | null,
    model: SnapshotModel,
    moves: MoveDirective[],
    deletes: MoveDirective[],
  ) => {
    const keepSide = plan.oneToOneKeep[key];
    if (keepSide) {
      const keepRow = keepSide === "a" ? gameA : gameB;
      const keepId =
        keepRow.id === survivor.id
          ? survivorRow?.id
          : discardedRow?.id;
      if (survivorRow && survivorRow.id !== keepId) {
        deletes.push({ id: survivorRow.id, row: { ...survivorRow } });
        pushDelete(model, survivorRow);
      }
      if (discardedRow) {
        if (discardedRow.id === keepId) {
          moves.push({ id: discardedRow.id, row: { ...discardedRow } });
          pushMove(model, discardedRow);
        } else {
          deletes.push({ id: discardedRow.id, row: { ...discardedRow } });
          pushDelete(model, discardedRow);
        }
      }
      return;
    }
    if (discardedRow) {
      moves.push({ id: discardedRow.id, row: { ...discardedRow } });
      pushMove(model, discardedRow);
    }
  };

  const wishlistMoves: MoveDirective[] = [];
  const wishlistDeletes: MoveDirective[] = [];
  resolveOneToOne(
    "wishlist",
    survivor.wishlistEntry,
    discarded.wishlistEntry,
    "WishlistEntry",
    wishlistMoves,
    wishlistDeletes,
  );

  const compatMoves: MoveDirective[] = [];
  const compatDeletes: MoveDirective[] = [];
  const compatProviders = new Set([
    ...survivor.compatSnapshots.map((row) => row.provider),
    ...discarded.compatSnapshots.map((row) => row.provider),
  ]);
  for (const provider of compatProviders) {
    resolveOneToOne(
      provider,
      survivor.compatSnapshots.find((row) => row.provider === provider) ?? null,
      discarded.compatSnapshots.find((row) => row.provider === provider) ?? null,
      "CompatibilitySnapshot",
      compatMoves,
      compatDeletes,
    );
  }

  const envMoves: MoveDirective[] = [];
  const envDeletes: MoveDirective[] = [];
  const environments = new Set([
    ...survivor.envCompat.map((row) => row.environment),
    ...discarded.envCompat.map((row) => row.environment),
  ]);
  for (const environment of environments) {
    resolveOneToOne(
      environment,
      survivor.envCompat.find((row) => row.environment === environment) ?? null,
      discarded.envCompat.find((row) => row.environment === environment) ?? null,
      "EnvironmentCompatibility",
      envMoves,
      envDeletes,
    );
  }

  const dlcMoves: MoveDirective[] = discarded.dlcs.map((row) => {
    pushMove("Game", row);
    return { id: row.id, row };
  });

  const duplicateMoves: MoveDirective[] = [];
  const duplicateDeletes: MoveDirective[] = [];
  const existingPairIds = new Set(
    [...survivor.duplicatesA, ...survivor.duplicatesB].map((row) => {
      const other = "gameBId" in row ? row.gameBId : row.gameAId;
      return orderedPair(survivor.id, other).join(":");
    }),
  );
  const promotedDuplicateIds = new Set<string>();
  for (const row of [...discarded.duplicatesA, ...discarded.duplicatesB]) {
    const other = "gameBId" in row ? row.gameBId : row.gameAId;
    if (other === survivor.id) {
      pushDelete("PossibleDuplicate", row);
      continue;
    }
    const pairKey = orderedPair(survivor.id, other).join(":");
    if (existingPairIds.has(pairKey) || promotedDuplicateIds.has(pairKey)) {
      duplicateDeletes.push({ id: row.id, row });
      pushDelete("PossibleDuplicate", row);
      continue;
    }
    duplicateMoves.push({ id: row.id, row });
    promotedDuplicateIds.add(pairKey);
    pushMove("PossibleDuplicate", row);
  }

  const survivorGameRow = {
    id: survivor.id,
    name: survivor.name,
    origin: survivor.origin,
    type: survivor.type,
    baseGameId: survivor.baseGameId,
    createdAt: survivor.createdAt,
    updatedAt: survivor.updatedAt,
    importAt: survivor.importAt,
  };
  pushMove("Game", survivorGameRow);

  const discardedGameDirective: MoveDirective = {
    id: discarded.id,
    row: {
      id: discarded.id,
      name: discarded.name,
      origin: discarded.origin,
      type: discarded.type,
      baseGameId: discarded.baseGameId,
      createdAt: discarded.createdAt,
      updatedAt: discarded.updatedAt,
      importAt: discarded.importAt,
    },
  };
  pushDelete("Game", discardedGameDirective.row);

  const affectedGameIds = [
    survivor.id,
    discarded.id,
    ...dlcMoves.map((move) => move.id),
  ];

  return {
    survivorId: survivor.id,
    discardedId: discarded.id,
    finalName: plan.finalName,
    libraryEntry,
    externalIdMoves,
    externalIdDeletes,
    availabilityMoves,
    availabilityDeletes,
    availabilityMerges,
    collectionMoves,
    collectionDeletes,
    tagMoves,
    tagDeletes,
    metadataMoves,
    metadataDeletes,
    wishlistMoves,
    wishlistDeletes,
    compatMoves,
    compatDeletes,
    envMoves,
    envDeletes,
    dlcMoves,
    duplicateMoves,
    duplicateDeletes,
    discardedGame: discardedGameDirective,
    affectedGameIds,
    snapshot: {
      survivorId: survivor.id,
      discardedId: discarded.id,
      records,
    },
  };
}