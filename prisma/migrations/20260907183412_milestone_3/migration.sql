-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "lastAiNarrativeAt" TIMESTAMP(3),
ADD COLUMN     "lastAnomalyCheckAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastAlertsViewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Alert_resolved_createdAt_idx" ON "Alert"("resolved", "createdAt");
