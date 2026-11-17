import { BadRequestException } from '@nestjs/common';
import { Weekday } from '../../../generated/prisma/enums.js';
import {
  assertGenerationRange,
  buildDepartures,
  Departure,
  MAX_GENERATION_DAYS,
  parseLocalDate,
} from './trip-schedule.util.js';

const ZONE = 'America/Guayaquil';
const ALL_DAYS = Object.values(Weekday);
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const day = (iso: string) => parseLocalDate(iso, ZONE);
const iso = (departures: Departure[]) => departures.map((d) => d.scheduledDeparture.toISOString());

describe('buildDepartures', () => {
  it('converts local wall time to UTC (08:00 Guayaquil -> 13:00Z)', () => {
    const result = buildDepartures(time('08:00'), ALL_DAYS, day('2026-12-01'), day('2026-12-01'));

    expect(iso(result)).toEqual(['2026-12-01T13:00:00.000Z']);
  });

  it('moves late departures to the next UTC day (21:30 local -> 02:30Z)', () => {
    const result = buildDepartures(time('21:30'), ALL_DAYS, day('2026-12-01'), day('2026-12-01'));

    expect(iso(result)).toEqual(['2026-12-02T02:30:00.000Z']);
  });

  it('iterates across a month change', () => {
    const result = buildDepartures(time('06:15'), ALL_DAYS, day('2026-11-29'), day('2026-12-02'));

    expect(iso(result)).toEqual([
      '2026-11-29T11:15:00.000Z',
      '2026-11-30T11:15:00.000Z',
      '2026-12-01T11:15:00.000Z',
      '2026-12-02T11:15:00.000Z',
    ]);
  });

  it('keeps only the frequency weekdays', () => {
    // 2026-11-23 es lunes
    const result = buildDepartures(
      time('08:00'),
      [Weekday.MONDAY, Weekday.FRIDAY, Weekday.SUNDAY],
      day('2026-11-23'),
      day('2026-11-29'),
    );

    expect(iso(result)).toEqual([
      '2026-11-23T13:00:00.000Z',
      '2026-11-27T13:00:00.000Z',
      '2026-11-29T13:00:00.000Z',
    ]);
    expect(result.map((d) => d.weekday)).toEqual([Weekday.MONDAY, Weekday.FRIDAY, Weekday.SUNDAY]);
  });

  it('returns nothing when no weekday falls in the range', () => {
    const result = buildDepartures(
      time('08:00'),
      [Weekday.SATURDAY],
      day('2026-11-23'),
      day('2026-11-27'),
    );

    expect(result).toEqual([]);
  });
});

describe('assertGenerationRange', () => {
  const today = day('2026-11-17');

  it('accepts a single day starting today', () => {
    expect(() => assertGenerationRange(today, today, today)).not.toThrow();
  });

  it(`accepts exactly ${MAX_GENERATION_DAYS} days`, () => {
    expect(() => assertGenerationRange(today, day('2026-12-17'), today)).not.toThrow();
  });

  it(`rejects ${MAX_GENERATION_DAYS + 1} days`, () => {
    expect(() => assertGenerationRange(today, day('2026-12-18'), today)).toThrow(
      BadRequestException,
    );
  });

  it('rejects from > to', () => {
    expect(() => assertGenerationRange(day('2026-11-20'), day('2026-11-19'), today)).toThrow(
      BadRequestException,
    );
  });

  it('rejects from before today', () => {
    expect(() => assertGenerationRange(day('2026-11-16'), day('2026-11-20'), today)).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid dates', () => {
    expect(() => assertGenerationRange(day('2026-02-30'), day('2026-03-01'), today)).toThrow(
      BadRequestException,
    );
  });
});
