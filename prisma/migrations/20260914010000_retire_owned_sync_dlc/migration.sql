-- DLCs are no longer derived from Steam owned-game sync and never have library entries.
DELETE FROM "LibraryEntry"
WHERE "gameId" IN (
  SELECT "id" FROM "Game" WHERE "type" = 'DLC'
);

DELETE FROM "UnresolvedSteamDlc"
WHERE "source" = 'OWNED_SYNC';
