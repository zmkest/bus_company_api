import { BusStatus } from '../../../generated/prisma/enums.js';

export const BUS_STATUS_TRANSITIONS: Record<BusStatus, readonly BusStatus[]> = {
  [BusStatus.AVAILABLE]: [BusStatus.ON_ROUTE, BusStatus.MAINTENANCE, BusStatus.OUT_OF_SERVICE],
  [BusStatus.ON_ROUTE]: [BusStatus.AVAILABLE],
  [BusStatus.OUT_OF_SERVICE]: [BusStatus.AVAILABLE, BusStatus.MAINTENANCE],
  [BusStatus.MAINTENANCE]: [BusStatus.AVAILABLE, BusStatus.OUT_OF_SERVICE],
};

export function canTransition(from: BusStatus, to: BusStatus): boolean {
  return BUS_STATUS_TRANSITIONS[from].includes(to);
}
