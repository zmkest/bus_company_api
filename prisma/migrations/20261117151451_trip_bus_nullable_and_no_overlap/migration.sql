-- AlterTable
ALTER TABLE "Trip" ALTER COLUMN "busId" DROP NOT NULL;

-- Manual: evita que un bus tenga dos viajes activos con horarios solapados
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_bus_no_overlap"
  EXCLUDE USING gist (
    "busId" WITH =,
    tsrange("scheduledDeparture", "scheduledArrival", '[)') WITH &&
  ) WHERE ("busId" IS NOT NULL AND "status" IN ('SCHEDULED', 'IN_PROGRESS'));
