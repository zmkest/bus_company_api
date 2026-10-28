-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Maintenance" ADD COLUMN     "status" "MaintenanceStatus" NOT NULL DEFAULT 'IN_PROGRESS';
