-- AlterTable
ALTER TABLE "SyncOperation" ADD COLUMN     "cloudConflictReason" TEXT,
ADD COLUMN     "cloudPushAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cloudPushStatus" "SyncStatus",
ADD COLUMN     "cloudPushedAt" TIMESTAMP(3),
ADD COLUMN     "seq" SERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "SyncOperation_deviceId_idx" ON "SyncOperation"("deviceId");

-- CreateIndex
CREATE INDEX "SyncOperation_status_cloudPushStatus_createdAt_idx" ON "SyncOperation"("status", "cloudPushStatus", "createdAt");
