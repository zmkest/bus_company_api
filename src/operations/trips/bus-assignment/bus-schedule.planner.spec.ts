import { TripStatus } from '../../../generated/prisma/enums.js';
import {
  BusCandidate,
  LabeledRoute,
  planBusAssignments,
  TimelineTrip,
} from './bus-schedule.planner.js';
import { UnassignedCode } from './assignment-conflict.js';

const route = (originId: number, destinationId: number): LabeledRoute => ({
  originId,
  destinationId,
  originLabel: `T${originId}`,
  destinationLabel: `T${destinationId}`,
});

// 1 = Cuenca, 2 = Quito
const cuencaQuito = route(1, 2);
const quitoCuenca = route(2, 1);
const bus = { id: 12, plate: 'ABC-0012' };

const at = (day: number, hour: number) => new Date(Date.UTC(2026, 11, day, hour));

const candidate = (r: LabeledRoute, day: number, hour: number, hours = 9): BusCandidate => ({
  route: r,
  bus,
  scheduledDeparture: at(day, hour),
  scheduledArrival: at(day, hour + hours),
});

const existing = (
  id: number,
  r: LabeledRoute,
  day: number,
  hour: number,
  status: TripStatus = TripStatus.SCHEDULED,
): TimelineTrip => ({ id, status, ...candidate(r, day, hour) });

describe('planBusAssignments', () => {
  it('accepts a continuous chain of candidates', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6), candidate(quitoCuenca, 8, 6), candidate(cuencaQuito, 9, 6)],
      new Map(),
      30,
    );

    expect(plan.accepted).toHaveLength(3);
    expect(plan.rejected).toHaveLength(0);
  });

  it('rejects a candidate that overlaps an existing trip and reports it', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6)],
      new Map([[bus.id, [existing(99, cuencaQuito, 7, 7)]]]),
      30,
    );

    expect(plan.rejected).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ code: UnassignedCode.OVERLAP, conflictTripId: 99 }),
      }),
    ]);
  });

  it('ignores cancelled existing trips', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6)],
      new Map([[bus.id, [existing(99, cuencaQuito, 7, 7, TripStatus.CANCELLED)]]]),
      30,
    );

    expect(plan.accepted).toHaveLength(1);
  });

  it('rejects a candidate that overlaps another candidate of the same batch', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6), candidate(quitoCuenca, 7, 15, 9)],
      new Map(),
      30,
    );

    expect(plan.accepted).toHaveLength(1);
    expect(plan.rejected[0].reason.code).toBe(UnassignedCode.OVERLAP);
    expect(plan.rejected[0].reason.conflictTripId).toBeUndefined();
  });

  it('rejects when a manual trip leaves the bus in another city', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6)],
      new Map([[bus.id, [existing(50, cuencaQuito, 6, 6)]]]),
      30,
    );

    expect(plan.rejected[0].reason).toMatchObject({
      code: UnassignedCode.LOCATION_MISMATCH,
      conflictTripId: 50,
    });
    expect(plan.rejected[0].reason.message).toContain('termina en T2');
  });

  it('rejects when the next existing trip leaves from another city', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6)],
      new Map([[bus.id, [existing(51, cuencaQuito, 9, 6)]]]),
      30,
    );

    expect(plan.rejected[0].reason).toMatchObject({
      code: UnassignedCode.LOCATION_MISMATCH,
      conflictTripId: 51,
    });
  });

  it('a rejected leg cascades to the next one that depends on its location', () => {
    const plan = planBusAssignments(
      [candidate(cuencaQuito, 7, 6), candidate(quitoCuenca, 8, 6), candidate(cuencaQuito, 9, 6)],
      new Map([[bus.id, [existing(60, quitoCuenca, 7, 4)]]]),
      30,
    );

    // El lunes choca; el bus queda en Cuenca, así que el martes (sale de Quito) tampoco cuadra
    expect(plan.rejected.map((r) => r.reason.code)).toEqual([
      UnassignedCode.OVERLAP,
      UnassignedCode.LOCATION_MISMATCH,
    ]);
    expect(plan.accepted).toHaveLength(1);
  });
});
