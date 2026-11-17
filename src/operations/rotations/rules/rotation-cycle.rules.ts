import { BadRequestException } from '@nestjs/common';
import { Weekday } from '../../../generated/prisma/enums.js';
import { WEEKDAY_ORDER } from '../../trips/common/trip-schedule.util.js';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export interface CycleLeg {
  frequencyId: number;
  weekday: Weekday;
  departureMinutes: number;
  durationMinutes: number;
  originId: number;
  destinationId: number;
  originLabel: string;
  destinationLabel: string;
  frequencyWeekdays: Weekday[];
  frequencyActive: boolean;
}

interface PlacedLeg extends CycleLeg {
  start: number;
  end: number;
}

const legName = (leg: CycleLeg) => `${WEEKDAY_LABEL[leg.weekday]} (frecuencia #${leg.frequencyId})`;

const clock = (minutes: number) => {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const legKey = (leg: { frequencyId: number; weekday: Weekday }) =>
  `${leg.frequencyId}:${leg.weekday}`;

/**
 * Los tramos se ubican en minutos desde el lunes 00:00 local y se recorren como ciclo
 * (el último conecta con el primero de la semana siguiente). El cierre se suma de forma
 * explícita en vez de usar módulo para que un gap negativo (tramos que se pisan) no pase.
 */
export function assertValidCycle(legs: CycleLeg[], turnaround: number) {
  if (legs.length === 0) {
    throw new BadRequestException('legs: La rotación debe tener al menos un tramo');
  }

  const seen = new Set<string>();
  for (const leg of legs) {
    if (seen.has(legKey(leg))) {
      throw new BadRequestException(`El tramo del ${legName(leg)} está repetido`);
    }
    seen.add(legKey(leg));

    if (!leg.frequencyActive) {
      throw new BadRequestException(
        `El tramo del ${legName(leg)} no es válido: la frecuencia está inactiva`,
      );
    }
    if (!leg.frequencyWeekdays.includes(leg.weekday)) {
      throw new BadRequestException(
        `El tramo del ${legName(leg)} no es válido: la frecuencia no opera ese día`,
      );
    }
  }

  const placed: PlacedLeg[] = legs
    .map((leg) => {
      const start = WEEKDAY_ORDER.indexOf(leg.weekday) * MINUTES_PER_DAY + leg.departureMinutes;
      return { ...leg, start, end: start + leg.durationMinutes };
    })
    .sort((a, b) => a.start - b.start);

  placed.forEach((current, i) => {
    const wraps = i === placed.length - 1;
    const next = wraps ? placed[0] : placed[i + 1];
    const nextStart = wraps ? next.start + MINUTES_PER_WEEK : next.start;
    const nextName = `${legName(next)}${wraps ? ' de la semana siguiente' : ''}`;

    if (current.destinationId !== next.originId) {
      throw new BadRequestException(
        `${legName(current)} termina en ${current.destinationLabel}, ` +
          `pero ${nextName} sale de ${next.originLabel}`,
      );
    }

    const gap = nextStart - current.end;
    if (gap < turnaround) {
      throw new BadRequestException(
        `${legName(current)} llega a las ${clock(current.end)} y ${nextName} sale a las ` +
          `${clock(next.start)}: hay ${gap} min y el margen mínimo es ${turnaround} min`,
      );
    }
  });
}
