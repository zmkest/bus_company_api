-- AlterTable
ALTER TABLE "Maintenance" ALTER COLUMN "cost" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Maintenance_busId_finishedAt_idx" ON "Maintenance"("busId", "finishedAt");
