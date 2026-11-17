import { continuityIssue, overlaps } from './bus-assignment.rules.js';

const slot = (dep: string, arr: string) => ({
  scheduledDeparture: new Date(`2026-12-01T${dep}:00Z`),
  scheduledArrival: new Date(`2026-12-01T${arr}:00Z`),
});

describe('overlaps', () => {
  const trip = slot('08:00', '12:00');

  it('detects a direct overlap', () => {
    expect(overlaps(trip, slot('10:00', '14:00'), 30)).toBe(true);
  });

  it('detects a trip contained in the other', () => {
    expect(overlaps(trip, slot('09:00', '10:00'), 0)).toBe(true);
  });

  it('back-to-back trips clash when there is a turnaround margin', () => {
    expect(overlaps(trip, slot('12:00', '16:00'), 30)).toBe(true);
    expect(overlaps(trip, slot('04:00', '08:00'), 30)).toBe(true);
  });

  it('back-to-back trips are fine without margin', () => {
    expect(overlaps(trip, slot('12:00', '16:00'), 0)).toBe(false);
  });

  it('a gap of exactly the margin does not clash', () => {
    expect(overlaps(trip, slot('12:30', '16:30'), 30)).toBe(false);
    expect(overlaps(trip, slot('03:30', '07:30'), 30)).toBe(false);
  });

  it('a gap shorter than the margin clashes', () => {
    expect(overlaps(trip, slot('12:29', '16:29'), 30)).toBe(true);
  });
});

describe('continuityIssue', () => {
  // Terminales: 1 = Quito, 2 = Guayaquil, 3 = Cuenca
  const quitoGye = { originId: 1, destinationId: 2 };
  const gyeQuito = { originId: 2, destinationId: 1 };
  const cuencaQuito = { originId: 3, destinationId: 1 };
  const gyeCuenca = { originId: 2, destinationId: 3 };

  it('allows when there are no previous or next trips', () => {
    expect(continuityIssue(quitoGye, null, null)).toBeNull();
  });

  it('allows a chained sequence', () => {
    expect(continuityIssue(quitoGye, gyeQuito, gyeCuenca)).toBeNull();
  });

  it('rejects when the previous trip ends elsewhere', () => {
    expect(continuityIssue(quitoGye, gyeCuenca, null)).toBe('previous');
  });

  it('rejects when the next trip departs elsewhere', () => {
    expect(continuityIssue(quitoGye, null, cuencaQuito)).toBe('next');
  });

  it('allows when the previous trip ends at this origin', () => {
    expect(continuityIssue(quitoGye, cuencaQuito, null)).toBeNull();
  });
});
