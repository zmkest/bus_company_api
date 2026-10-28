import { BusStatus } from '../../../generated/prisma/enums.js';
import { canTransition } from './bus-status.rules.js';

const ALL = Object.values(BusStatus);

const VALID: [BusStatus, BusStatus][] = [
  [BusStatus.AVAILABLE, BusStatus.ON_ROUTE],
  [BusStatus.AVAILABLE, BusStatus.MAINTENANCE],
  [BusStatus.AVAILABLE, BusStatus.OUT_OF_SERVICE],
  [BusStatus.MAINTENANCE, BusStatus.AVAILABLE],
  [BusStatus.MAINTENANCE, BusStatus.OUT_OF_SERVICE],
  [BusStatus.ON_ROUTE, BusStatus.AVAILABLE],
  [BusStatus.OUT_OF_SERVICE, BusStatus.AVAILABLE],
  [BusStatus.OUT_OF_SERVICE, BusStatus.MAINTENANCE],
];

const INVALID = ALL.flatMap((from) => ALL.map((to) => [from, to] as const)).filter(
  ([from, to]) => !VALID.some(([f, t]) => f === from && t === to),
);

describe('canTransition', () => {
  it.each(VALID)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(INVALID)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
