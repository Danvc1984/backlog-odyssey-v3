CREATE UNIQUE INDEX "SyncRun_one_active_rawg_batch_key"
ON "SyncRun" ("provider")
WHERE "provider" = 'RAWG' AND "status" = 'RUNNING';
