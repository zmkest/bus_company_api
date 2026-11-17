import { ConflictException } from '@nestjs/common';

const OVERLAP_CONSTRAINT = 'Trip_bus_no_overlap';

/** Violación de la exclusion constraint de la base (respaldo ante carreras) */
export const isBusOverlapViolation = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes(OVERLAP_CONSTRAINT) ||
    JSON.stringify(error).includes(OVERLAP_CONSTRAINT) ||
    JSON.stringify(error).includes('23P01'));

export function rethrowBusOverlap(error: unknown): never {
  if (isBusOverlapViolation(error)) {
    throw new ConflictException('El bus ya tiene otro viaje en ese horario');
  }
  throw error;
}
