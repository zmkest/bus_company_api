import { Injectable, NotFoundException } from '@nestjs/common';
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
  terminalLabelSelect,
} from './assignment-messages.js';

export interface TripToAssign extends TimeSlot {
  id?: number;
  route: RouteEnds;
}

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
