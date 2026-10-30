/*
  Warnings:

  - Added the required column `estimatedArrival` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "estimatedArrival" TIMESTAMP(3) NOT NULL;
