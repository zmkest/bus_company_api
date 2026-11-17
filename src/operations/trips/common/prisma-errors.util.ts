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

const ACTIVE_BUS_INDEX = 'rotation_active_bus_unique';

const errorText = (error: unknown) =>
  error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : '';

/** Respaldo de la base ante carreras: índice parcial del bus y @@unique(frequencyId, weekday) */
export function rethrowRotationConflict(error: unknown): never {
  const text = errorText(error);
  if (text.includes(ACTIVE_BUS_INDEX)) {
    throw new ConflictException('El bus ya pertenece a otra rotación activa');
  }
  if (text.includes('P2002') && text.includes('RotationLeg')) {
    throw new ConflictException('Uno de los tramos ya está cubierto por otra rotación');
  }
  throw error;
}
