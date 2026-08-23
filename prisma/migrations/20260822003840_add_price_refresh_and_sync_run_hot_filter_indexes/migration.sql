-- CreateIndex
CREATE INDEX "PriceRefresh_status_requestedAt_idx" ON "PriceRefresh"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "SyncRun_provider_status_idx" ON "SyncRun"("provider", "status");
