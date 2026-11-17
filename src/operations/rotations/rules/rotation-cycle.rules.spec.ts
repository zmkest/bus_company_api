import { BadRequestException } from '@nestjs/common';
import { Weekday } from '../../../generated/prisma/enums.js';
import { assertValidCycle, CycleLeg } from './rotation-cycle.rules.js';

const { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY } = Weekday;
const WEEKDAYS = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY];

// Terminales: 1 = Cuenca, 2 = Quito, 3 = Loja
const CITY: Record<number, string> = {
  1: 'Terminal Cuenca',
  2: 'Terminal Quito',
  3: 'Terminal Loja',
};
const TURNAROUND = 30;

const frequency = (
  id: number,
  originId: number,
  destinationId: number,
  hhmm: string,
  weekdays: Weekday[],
  durationMinutes = 540,
) => {
  const [h, m] = hhmm.split(':').map(Number);
  return { id, originId, destinationId, departureMinutes: h * 60 + m, weekdays, durationMinutes };
};

type Freq = ReturnType<typeof frequency>;

const F1 = frequency(1, 1, 2, '06:00', WEEKDAYS);
const F2 = frequency(2, 2, 1, '06:00', WEEKDAYS);
const F3 = frequency(3, 2, 1, '08:00', [SATURDAY]);
const F4 = frequency(4, 1, 2, '14:00', [SUNDAY]);

const leg = (f: Freq, weekday: Weekday, active = true): CycleLeg => ({
  frequencyId: f.id,
  weekday,
  departureMinutes: f.departureMinutes,
  durationMinutes: f.durationMinutes,
  originId: f.originId,
  destinationId: f.destinationId,
  originLabel: CITY[f.originId],
  destinationLabel: CITY[f.destinationId],
  frequencyWeekdays: f.weekdays,
  frequencyActive: active,
});

const rotationA = [
  leg(F1, MONDAY),
  leg(F2, TUESDAY),
  leg(F1, WEDNESDAY),
  leg(F2, THURSDAY),
  leg(F1, FRIDAY),
  leg(F3, SATURDAY),
];

const rotationB = [
  leg(F2, MONDAY),
  leg(F1, TUESDAY),
  leg(F2, WEDNESDAY),
  leg(F1, THURSDAY),
  leg(F2, FRIDAY),
  leg(F4, SUNDAY),
];

const errorOf = (legs: CycleLeg[]) => {
  try {
    assertValidCycle(legs, TURNAROUND);
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return (e as Error).message;
  }
  throw new Error('Se esperaba un error de validación');
};

describe('assertValidCycle', () => {
  it('accepts the example rotations A and B', () => {
    expect(() => assertValidCycle(rotationA, TURNAROUND)).not.toThrow();
    expect(() => assertValidCycle(rotationB, TURNAROUND)).not.toThrow();
  });

  it('does not depend on the order the legs are sent', () => {
    expect(() => assertValidCycle([...rotationA].reverse(), TURNAROUND)).not.toThrow();
  });

  it('rejects a cycle that does not close (Friday ends in Quito, Monday leaves from Cuenca)', () => {
    const message = errorOf(rotationA.filter((l) => l.weekday !== SATURDAY));

    expect(message).toContain('Viernes (frecuencia #1) termina en Terminal Quito');
    expect(message).toContain(
      'Lunes (frecuencia #1) de la semana siguiente sale de Terminal Cuenca',
    );
  });

  it('rejects a leg whose origin does not match the previous destination', () => {
    const toLoja = frequency(5, 3, 1, '08:00', [SATURDAY]);
    const legs = [...rotationA.slice(0, 5), leg(toLoja, SATURDAY)];

    const message = errorOf(legs);

    expect(message).toBe(
      'Viernes (frecuencia #1) termina en Terminal Quito, pero Sábado (frecuencia #5) sale de Terminal Loja',
    );
  });

  it('rejects when the turnaround margin is not met', () => {
    // F1 llega a Quito el lunes a las 15:00; F6 sale de Quito a las 15:10
    const F6 = frequency(6, 2, 1, '15:10', [MONDAY]);

    const message = errorOf([leg(F1, MONDAY), leg(F6, MONDAY)]);

    expect(message).toContain('Lunes (frecuencia #1) llega a las 15:00');
    expect(message).toContain('Lunes (frecuencia #6) sale a las 15:10');
    expect(message).toContain('hay 10 min y el margen mínimo es 30 min');
  });

  it('accepts several legs on the same day when the margin is met', () => {
    const back = frequency(6, 2, 1, '15:30', [MONDAY]);

    expect(() => assertValidCycle([leg(F1, MONDAY), leg(back, MONDAY)], TURNAROUND)).not.toThrow();
  });

  it('handles a leg that crosses midnight', () => {
    // Sale 20:00 del lunes y llega 05:00 del martes
    const night = frequency(6, 1, 2, '20:00', [MONDAY]);
    const tooEarly = frequency(7, 2, 1, '05:15', [TUESDAY]);
    const onTime = frequency(8, 2, 1, '06:00', [TUESDAY]);

    const message = errorOf([leg(night, MONDAY), leg(tooEarly, TUESDAY)]);
    expect(message).toContain('llega a las 05:00');
    expect(message).toContain('hay 15 min');

    expect(() =>
      assertValidCycle([leg(night, MONDAY), leg(onTime, TUESDAY)], TURNAROUND),
    ).not.toThrow();
  });

  it('handles a Sunday leg that crosses into Monday of the next week', () => {
    const night = frequency(6, 1, 2, '22:00', [SUNDAY]);
    const monday = frequency(7, 2, 1, '07:15', [MONDAY]);

    const message = errorOf([leg(monday, MONDAY), leg(night, SUNDAY)]);

    expect(message).toContain('Domingo (frecuencia #6) llega a las 07:00');
    expect(message).toContain('de la semana siguiente sale a las 07:15');
  });

  it('rejects overlapping legs instead of wrapping the negative gap', () => {
    const overlapping = frequency(6, 2, 1, '10:00', [MONDAY]);

    expect(errorOf([leg(F1, MONDAY), leg(overlapping, MONDAY)])).toContain('hay -300 min');
  });

  it('rejects a weekday the frequency does not operate', () => {
    expect(errorOf([leg(F3, SUNDAY)])).toBe(
      'El tramo del Domingo (frecuencia #3) no es válido: la frecuencia no opera ese día',
    );
  });

  it('rejects an inactive frequency', () => {
    expect(errorOf([leg(F1, MONDAY, false), leg(F2, TUESDAY)])).toContain(
      'la frecuencia está inactiva',
    );
  });

  it('rejects a repeated leg', () => {
    expect(errorOf([...rotationA, leg(F1, MONDAY)])).toContain('está repetido');
  });

  it('rejects an empty rotation', () => {
    expect(errorOf([])).toContain('al menos un tramo');
  });
});
