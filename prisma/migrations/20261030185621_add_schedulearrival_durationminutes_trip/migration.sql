/*
  Warnings:

  - Added the required column `durationMinutes` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledArrival` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "durationMinutes" INTEGER NOT NULL,
ADD COLUMN     "scheduledArrival" TIMESTAMP(3) NOT NULL;
