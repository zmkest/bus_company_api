import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '../../../generated/prisma/client.js';
import { BusStatus, TripStatus } from '../../../generated/prisma/enums.js';
import { envs } from '../../../config/envs.js';
import { continuityIssue, RouteEnds, TimeSlot, turnaroundWindow } from './bus-assignment.rules.js';
import { BusAssignmentConflict, UnassignedCode } from './assignment-conflict.js';
import {
  label,
  nextMismatchMessage,
  overlapMessage,
  previousMismatchMessage,
  TerminalLabel,
  terminalLabelSelect,
} from './assignment-messages.js';
import { LabeledRoute, TimelineTrip } from './bus-schedule.planner.js';

export interface TripToAssign extends TimeSlot {
  id?: number;
  route: RouteEnds;
}

export const labeledRouteSelect = {
  originId: true,
  destinationId: true,
  durationMinutes: true,
  origin: terminalLabelSelect,
  destination: terminalLabelSelect,
} as const;

export const toLabeledRoute = (route: {
  originId: number;
  destinationId: number;
  origin: TerminalLabel;
  destination: TerminalLabel;
}): LabeledRoute => ({
  originId: route.originId,
  destinationId: route.destinationId,
  originLabel: label(route.origin),
  destinationLabel: label(route.destination),
});

const neighborSelect = {
  id: true,
  scheduledDeparture: true,
  route: {
    select: {
      originId: true,
      destinationId: true,
      origin: terminalLabelSelect,
      destination: terminalLabelSelect,
    },
  },
} as const;

@Injectable()
export class BusAssignmentService {
  /** Bloquea el bus y valida estado, solapamiento (con margen) y continuidad de ubicación */
  async assertCanAssign(tx: Prisma.TransactionClient, busId: number, trip: TripToAssign) {
    const [bus] = await tx.$queryRaw<{ id: number; plate: string; status: BusStatus }[]>`
      SELECT id, plate, status FROM "Bus" WHERE id = ${busId} FOR UPDATE`;

    if (!bus) throw new NotFoundException(`Bus con id #${busId} no existe`);
    if (bus.status === BusStatus.OUT_OF_SERVICE) {
      throw new BusAssignmentConflict(
        `El bus ${bus.plate} está fuera de servicio`,
        UnassignedCode.BUS_OUT_OF_SERVICE,
      );
    }

    await this.assertNoOverlap(tx, bus, trip);
    await this.assertContinuity(tx, bus, trip);

    return bus;
  }

  /** Viajes no cancelados de cada bus alrededor del rango, más el vecino inmediato en cada borde */
  async loadBusTimelines(
    tx: Prisma.TransactionClient,
    busIds: number[],
    from: DateTime,
    to: DateTime,
  ) {
    const timelines = new Map<number, TimelineTrip[]>();
    if (busIds.length === 0) return timelines;

    const start = from.minus({ days: 1 }).toJSDate();
    const end = to.plus({ days: 2 }).toJSDate();
    const select = {
      id: true,
      busId: true,
      status: true,
      scheduledDeparture: true,
      scheduledArrival: true,
      route: { select: labeledRouteSelect },
    } as const;
    const active = { not: TripStatus.CANCELLED };

    const trips = await tx.trip.findMany({
      where: {
        busId: { in: busIds },
        status: active,
        scheduledDeparture: { gte: start, lt: end },
      },
      select,
    });

    // Secuencial: dentro de una transacción las consultas comparten la misma conexión
    for (const busId of busIds) {
      const previous = await tx.trip.findFirst({
        where: { busId, status: active, scheduledDeparture: { lt: start } },
        orderBy: { scheduledDeparture: 'desc' },
        select,
      });
      const next = await tx.trip.findFirst({
        where: { busId, status: active, scheduledDeparture: { gte: end } },
        orderBy: { scheduledDeparture: 'asc' },
        select,
      });
      if (previous) trips.push(previous);
      if (next) trips.push(next);
    }

    for (const trip of trips) {
      if (!trip.busId) continue;
      const list = timelines.get(trip.busId) ?? [];
      list.push({ ...trip, route: toLabeledRoute(trip.route) });
      timelines.set(trip.busId, list);
    }

    return timelines;
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    bus: { id: number; plate: string },
    trip: TripToAssign,
  ) {
    const turnaround = envs.turnaround_minutes;
    const { start, end } = turnaroundWindow(trip, turnaround);

    const clash = await tx.trip.findFirst({
      where: {
        busId: bus.id,
        status: { in: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS] },
        scheduledDeparture: { lt: end },
        scheduledArrival: { gt: start },
        ...(trip.id && { id: { not: trip.id } }),
      },
      select: { id: true, scheduledDeparture: true, scheduledArrival: true },
      orderBy: { scheduledDeparture: 'asc' },
    });

    if (clash) {
      throw new BusAssignmentConflict(
        overlapMessage(bus.plate, clash, turnaround),
        UnassignedCode.OVERLAP,
        clash.id,
      );
    }
  }

  private async assertContinuity(
    tx: Prisma.TransactionClient,
    bus: { id: number; plate: string },
    trip: TripToAssign,
  ) {
    const base: Prisma.TripWhereInput = {
      busId: bus.id,
      status: { not: TripStatus.CANCELLED },
      ...(trip.id && { id: { not: trip.id } }),
    };

    const [previous, next] = await Promise.all([
      tx.trip.findFirst({
        where: { ...base, scheduledDeparture: { lt: trip.scheduledDeparture } },
        orderBy: { scheduledDeparture: 'desc' },
        select: neighborSelect,
      }),
      tx.trip.findFirst({
        where: { ...base, scheduledDeparture: { gt: trip.scheduledDeparture } },
        orderBy: { scheduledDeparture: 'asc' },
        select: neighborSelect,
      }),
    ]);

    const issue = continuityIssue(trip.route, previous?.route, next?.route);
    if (!issue) return;

    const [origin, destination] = await Promise.all(
      [trip.route.originId, trip.route.destinationId].map((id) =>
        tx.terminal.findUniqueOrThrow({ where: { id }, ...terminalLabelSelect }),
      ),
    );

    if (issue === 'previous' && previous) {
      throw new BusAssignmentConflict(
        previousMismatchMessage(
          bus.plate,
          previous.id,
          label(previous.route.destination),
          label(origin),
        ),
        UnassignedCode.LOCATION_MISMATCH,
        previous.id,
      );
    }

    if (next) {
      throw new BusAssignmentConflict(
        nextMismatchMessage(bus.plate, next.id, label(next.route.origin), label(destination)),
        UnassignedCode.LOCATION_MISMATCH,
        next.id,
      );
    }
  }
}
