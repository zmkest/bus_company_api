/*
  Warnings:

  - You are about to drop the column `city` on the `Terminal` table. All the data in the column will be lost.
  - Added the required column `cityId` to the `Terminal` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Terminal_city_name_key";

-- AlterTable
ALTER TABLE "Terminal" DROP COLUMN "city",
ADD COLUMN     "cityId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
