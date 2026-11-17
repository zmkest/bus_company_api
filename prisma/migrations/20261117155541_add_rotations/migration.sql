-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "rotationId" INTEGER;

-- CreateTable
CREATE TABLE "Rotation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "busId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationLeg" (
    "id" SERIAL NOT NULL,
    "rotationId" INTEGER NOT NULL,
    "frequencyId" INTEGER NOT NULL,
    "weekday" "Weekday" NOT NULL,

    CONSTRAINT "RotationLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rotation_busId_idx" ON "Rotation"("busId");

-- CreateIndex
CREATE INDEX "RotationLeg_rotationId_idx" ON "RotationLeg"("rotationId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationLeg_frequencyId_weekday_key" ON "RotationLeg"("frequencyId", "weekday");

-- CreateIndex
CREATE INDEX "Trip_rotationId_scheduledDeparture_idx" ON "Trip"("rotationId", "scheduledDeparture");

-- AddForeignKey
ALTER TABLE "Rotation" ADD CONSTRAINT "Rotation_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationLeg" ADD CONSTRAINT "RotationLeg_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationLeg" ADD CONSTRAINT "RotationLeg_frequencyId_fkey" FOREIGN KEY ("frequencyId") REFERENCES "Frequency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual: un bus solo puede estar en una rotación activa
CREATE UNIQUE INDEX "rotation_active_bus_unique" ON "Rotation"("busId") WHERE "isActive" AND "busId" IS NOT NULL;
