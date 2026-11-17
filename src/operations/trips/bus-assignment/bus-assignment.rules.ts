import { addMinutes } from '../common/trip-schedule.util.js';

export interface TimeSlot {
  scheduledDeparture: Date;
  scheduledArrival: Date;
}

export interface RouteEnds {
  originId: number;
  destinationId: number;
}

/** Ventana que ocupa el bus: el viaje más el margen de vuelta antes y después */
export const turnaroundWindow = (slot: TimeSlot, turnaroundMinutes: number) => ({
  start: addMinutes(slot.scheduledDeparture, -turnaroundMinutes),
  end: addMinutes(slot.scheduledArrival, turnaroundMinutes),
});

export function overlaps(a: TimeSlot, b: TimeSlot, turnaroundMinutes: number) {
  const { start, end } = turnaroundWindow(a, turnaroundMinutes);
  return b.scheduledDeparture < end && b.scheduledArrival > start;
}

/** El bus debe llegar a donde sale este viaje y salir el siguiente desde donde este termina */
export function continuityIssue(
  current: RouteEnds,
  previous?: RouteEnds | null,
  next?: RouteEnds | null,
): 'previous' | 'next' | null {
  if (previous && previous.destinationId !== current.originId) return 'previous';
  if (next && next.originId !== current.destinationId) return 'next';
  return null;
}
