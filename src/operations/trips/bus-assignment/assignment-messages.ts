import { DateTime } from 'luxon';
import { envs } from '../../../config/envs.js';
import { TimeSlot } from './bus-assignment.rules.js';

export type TerminalLabel = { name: string; city: { name: string } };

export const terminalLabelSelect = {
  select: { name: true, city: { select: { name: true } } },
} as const;

export const label = (t: TerminalLabel) => `${t.name} (${t.city.name})`;

export const formatLocal = (date: Date) =>
  DateTime.fromJSDate(date).setZone(envs.app_timezone).toFormat('dd/MM/yyyy HH:mm');

export const overlapMessage = (
  plate: string,
  clash: TimeSlot & { id?: number },
  turnaround: number,
) =>
  `El bus ${plate} tiene ${clash.id ? `el viaje #${clash.id}` : 'otro viaje del lote'} ` +
  `(${formatLocal(clash.scheduledDeparture)} - ${formatLocal(clash.scheduledArrival)}) ` +
  `que se cruza con este viaje (margen de ${turnaround} min)`;

export const previousMismatchMessage = (
  plate: string,
  previousId: number | undefined,
  previousDestination: string,
  origin: string,
) =>
  `El viaje anterior ${previousId ? `#${previousId}` : 'del lote'} del bus ${plate} termina en ` +
  `${previousDestination}, pero este viaje sale de ${origin}`;

export const nextMismatchMessage = (
  plate: string,
  nextId: number | undefined,
  nextOrigin: string,
  destination: string,
) =>
  `El viaje siguiente ${nextId ? `#${nextId}` : 'del lote'} del bus ${plate} sale de ` +
  `${nextOrigin}, pero este viaje termina en ${destination}`;
