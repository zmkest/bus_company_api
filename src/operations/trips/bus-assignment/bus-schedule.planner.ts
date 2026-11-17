import { TripStatus } from '../../../generated/prisma/enums.js';
import { continuityIssue, overlaps, RouteEnds, TimeSlot } from './bus-assignment.rules.js';
import { UnassignedCode, UnassignedReason } from './assignment-conflict.js';
import {
  nextMismatchMessage,
  overlapMessage,
  previousMismatchMessage,
} from './assignment-messages.js';

export interface LabeledRoute extends RouteEnds {
  originLabel: string;
  destinationLabel: string;
}

export interface TimelineTrip extends TimeSlot {
  id?: number;
  status: TripStatus;
  route: LabeledRoute;
}

export interface BusCandidate extends TimeSlot {
  route: LabeledRoute;
  bus: { id: number; plate: string };
}

export interface BusPlan<T extends BusCandidate> {
  accepted: T[];
  rejected: { candidate: T; reason: UnassignedReason }[];
}

const BLOCKING: TripStatus[] = [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS];

const byDeparture = (a: TimeSlot, b: TimeSlot) =>
  a.scheduledDeparture.getTime() - b.scheduledDeparture.getTime();

/**
 * Valida en memoria los candidatos de un lote contra los viajes existentes de cada bus y
 * contra los candidatos ya aceptados. Se procesan en orden cronológico para que un rechazo
 * afecte la continuidad de los siguientes.
 */
export function planBusAssignments<T extends BusCandidate>(
  candidates: T[],
  existing: Map<number, TimelineTrip[]>,
  turnaround: number,
): BusPlan<T> {
  const timelines = new Map<number, TimelineTrip[]>();
  for (const [busId, trips] of existing) {
    timelines.set(busId, trips.filter((t) => t.status !== TripStatus.CANCELLED).sort(byDeparture));
  }

  const plan: BusPlan<T> = { accepted: [], rejected: [] };

  for (const candidate of [...candidates].sort(byDeparture)) {
    const timeline = timelines.get(candidate.bus.id) ?? [];
    const reason = findIssue(candidate, timeline, turnaround);

    if (reason) {
      plan.rejected.push({ candidate, reason });
      continue;
    }

    plan.accepted.push(candidate);
    timeline.push({ ...candidate, status: TripStatus.SCHEDULED });
    timeline.sort(byDeparture);
    timelines.set(candidate.bus.id, timeline);
  }

  return plan;
}

function findIssue(
  candidate: BusCandidate,
  timeline: TimelineTrip[],
  turnaround: number,
): UnassignedReason | null {
  const { plate } = candidate.bus;

  const clash = timeline.find(
    (t) => BLOCKING.includes(t.status) && overlaps(candidate, t, turnaround),
  );
  if (clash) {
    return {
      code: UnassignedCode.OVERLAP,
      message: overlapMessage(plate, clash, turnaround),
      ...(clash.id && { conflictTripId: clash.id }),
    };
  }

  const departure = candidate.scheduledDeparture.getTime();
  const previous = timeline.findLast((t) => t.scheduledDeparture.getTime() < departure);
  const next = timeline.find((t) => t.scheduledDeparture.getTime() > departure);

  const issue = continuityIssue(candidate.route, previous?.route, next?.route);
  if (issue === 'previous' && previous) {
    return {
      code: UnassignedCode.LOCATION_MISMATCH,
      message: previousMismatchMessage(
        plate,
        previous.id,
        previous.route.destinationLabel,
        candidate.route.originLabel,
      ),
      ...(previous.id && { conflictTripId: previous.id }),
    };
  }
  if (issue === 'next' && next) {
    return {
      code: UnassignedCode.LOCATION_MISMATCH,
      message: nextMismatchMessage(
        plate,
        next.id,
        next.route.originLabel,
        candidate.route.destinationLabel,
      ),
      ...(next.id && { conflictTripId: next.id }),
    };
  }

  return null;
}
