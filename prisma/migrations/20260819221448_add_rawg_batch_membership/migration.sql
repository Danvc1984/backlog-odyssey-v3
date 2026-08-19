-- AlterTable
ALTER TABLE "EnrichmentJob" ADD COLUMN     "syncRunId" TEXT;

-- CreateIndex
CREATE INDEX "EnrichmentJob_syncRunId_idx" ON "EnrichmentJob"("syncRunId");

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
