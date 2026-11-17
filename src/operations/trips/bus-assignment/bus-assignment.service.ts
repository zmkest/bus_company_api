import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '../../../generated/prisma/client.js';
import { BusStatus, TripStatus } from '../../../generated/prisma/enums.js';
import { envs } from '../../../config/envs.js';
import { continuityIssue, RouteEnds, TimeSlot, turnaroundWindow } from './bus-assignment.rules.js';

export interface TripToAssign extends TimeSlot {
  id?: number;
  route: RouteEnds;
}

const terminalLabel = {
  select: { name: true, city: { select: { name: true } } },
} as const;

const neighborSelect = {
  id: true,
  scheduledDeparture: true,
  route: {
    select: {
      originId: true,
      destinationId: true,
      origin: terminalLabel,
      destination: terminalLabel,
    },
  },
} as const;

type Terminal = { name: string; city: { name: string } };

const label = (t: Terminal) => `${t.name} (${t.city.name})`;

const formatLocal = (date: Date) =>
  DateTime.fromJSDate(date).setZone(envs.app_timezone).toFormat('dd/MM/yyyy HH:mm');

@Injectable()
export class BusAssignmentService {
  /** Bloquea el bus y valida estado, solapamiento (con margen) y continuidad de ubicación */
  async assertCanAssign(tx: Prisma.TransactionClient, busId: number, trip: TripToAssign) {
    const [bus] = await tx.$queryRaw<{ id: number; plate: string; status: BusStatus }[]>`
      SELECT id, plate, status FROM "Bus" WHERE id = ${busId} FOR UPDATE`;

    if (!bus) throw new NotFoundException(`Bus con id #${busId} no existe`);
    if (bus.status === BusStatus.OUT_OF_SERVICE) {
      throw new ConflictException(`El bus ${bus.plate} está fuera de servicio`);
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
      throw new ConflictException(
        `El bus ${bus.plate} tiene el viaje #${clash.id} (${formatLocal(clash.scheduledDeparture)} - ` +
          `${formatLocal(clash.scheduledArrival)}) que se cruza con este viaje (margen de ${turnaround} min)`,
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
        tx.terminal.findUniqueOrThrow({ where: { id }, ...terminalLabel }),
      ),
    );

    if (issue === 'previous' && previous) {
      throw new ConflictException(
        `El viaje anterior #${previous.id} del bus ${bus.plate} termina en ` +
          `${label(previous.route.destination)}, pero este viaje sale de ${label(origin)}`,
      );
    }

    if (next) {
      throw new ConflictException(
        `El viaje siguiente #${next.id} del bus ${bus.plate} sale de ` +
          `${label(next.route.origin)}, pero este viaje termina en ${label(destination)}`,
      );
    }
  }
}
