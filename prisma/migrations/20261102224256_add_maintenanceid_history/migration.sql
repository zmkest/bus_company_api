/*
  Warnings:

  - A unique constraint covering the columns `[maintenanceId]` on the table `BusStatusHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BusStatusHistory" ADD COLUMN     "maintenanceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BusStatusHistory_maintenanceId_key" ON "BusStatusHistory"("maintenanceId");

-- AddForeignKey
ALTER TABLE "BusStatusHistory" ADD CONSTRAINT "BusStatusHistory_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "Maintenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
