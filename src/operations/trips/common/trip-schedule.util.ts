import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Weekday } from '../../../generated/prisma/enums.js';

export const MAX_GENERATION_DAYS = 31;

// Mismo orden que luxon: weekday 1 = lunes ... 7 = domingo
const WEEKDAY_ORDER = Object.values(Weekday);

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

export const parseLocalDate = (value: string, zone: string) =>
  DateTime.fromISO(value, { zone }).startOf('day');

export const todayIn = (zone: string) => DateTime.now().setZone(zone).startOf('day');

export function assertGenerationRange(from: DateTime, to: DateTime, today: DateTime) {
  if (!from.isValid || !to.isValid) {
    throw new BadRequestException('from/to: Deben ser fechas válidas (YYYY-MM-DD)');
  }
  if (from > to) {
    throw new BadRequestException('from: Debe ser menor o igual a to');
  }
  if (from < today) {
    throw new BadRequestException('from: No puede ser anterior a hoy');
  }

  const days = Math.round(to.diff(from, 'days').days) + 1;
  if (days > MAX_GENERATION_DAYS) {
    throw new BadRequestException(
      `El rango no puede superar ${MAX_GENERATION_DAYS} días (se enviaron ${days})`,
    );
  }
}

/** departureTime es hora local de pared guardada como 1970-01-01THH:mm:00Z */
export function buildDepartures(
  departureTime: Date,
  weekdays: Weekday[],
  from: DateTime,
  to: DateTime,
): Date[] {
  const hour = departureTime.getUTCHours();
  const minute = departureTime.getUTCMinutes();
  const departures: Date[] = [];

  for (let day = from; day <= to; day = day.plus({ days: 1 })) {
    if (!weekdays.includes(WEEKDAY_ORDER[day.weekday - 1])) continue;
    departures.push(day.set({ hour, minute, second: 0, millisecond: 0 }).toJSDate());
  }

  return departures;
}
