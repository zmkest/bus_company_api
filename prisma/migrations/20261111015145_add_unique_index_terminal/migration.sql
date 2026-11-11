/*
  Warnings:

  - A unique constraint covering the columns `[name,cityId]` on the table `Terminal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Terminal_cityId_idx" ON "Terminal"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_name_cityId_key" ON "Terminal"("name", "cityId");
