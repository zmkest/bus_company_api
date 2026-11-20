import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BusStatus, TripStatus, Weekday } from '../../generated/prisma/enums.js';
import { envs } from '../../config/envs.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { DateTime } from 'luxon';
import {
  BusAssignmentService,
  labeledRouteSelect,
  toLabeledRoute,
} from '../trips/bus-assignment/bus-assignment.service.js';
import { planBusAssignments } from '../trips/bus-assignment/bus-schedule.planner.js';
import { UnassignedCode, UnassignedReason } from '../trips/bus-assignment/assignment-conflict.js';
import { label, terminalLabelSelect } from '../trips/bus-assignment/assignment-messages.js';
import {
  minutesOfDay,
  parseLocalDate,
  todayIn,
  weekdayOf,
} from '../trips/common/trip-schedule.util.js';
import {
  isBusOverlapViolation,
  rethrowBusOverlap,
  rethrowRotationConflict,
} from '../trips/common/prisma-errors.util.js';
import { assertValidCycle, CycleLeg, legKey, WEEKDAY_LABEL } from './rules/rotation-cycle.rules.js';
import { CreateRotationDto, RotationLegDto } from './dto/create-rotation.dto.js';
import { UpdateRotationDto } from './dto/update-rotation.dto.js';
import { FindRotationsQueryDto } from './dto/find-rotations-query.dto.js';
import { ChangeRotationBusDto } from './dto/change-rotation-bus.dto.js';

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 30_000 } as const;

const terminalSelect = {
  select: { id: true, name: true, city: { select: { id: true, name: true } } },
} as const;

const rotationInclude = {
  bus: { select: { id: true, plate: true, model: true, status: true } },
  legs: {
    orderBy: [{ weekday: 'asc' }, { frequency: { departureTime: 'asc' } }],
    select: {
      id: true,
      weekday: true,
      frequency: {
        select: {
          id: true,
          departureTime: true,
          isActive: true,
          route: {
            select: {
              id: true,
              durationMinutes: true,
              origin: terminalSelect,
              destination: terminalSelect,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RotationInclude;

export interface RotationTripUnassigned extends UnassignedReason {
  tripId: number;
  frequencyId: number | null;
  scheduledDeparture: Date;
}

@Injectable()
export class RotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly busAssignment: BusAssignmentService,
  ) {}

  async create(dto: CreateRotationDto) {
    const { id } = await this.prisma
      .$transaction(async (tx) => {
        await this.assertLegs(tx, dto.legs);
        if (dto.busId !== undefined) await this.assertBusUsable(tx, dto.busId);

        return tx.rotation.create({
          data: {
            name: dto.name,
            busId: dto.busId ?? null,
            legs: {
              createMany: {
                data: dto.legs.map(({ frequencyId, weekday }) => ({ frequencyId, weekday })),
              },
            },
          },
          select: { id: true },
        });
      }, TX_OPTIONS)
      .catch(rethrowRotationConflict);

    return this.findOne(id);
  }

  async findAll(query: FindRotationsQueryDto) {
    const { limit, page, order, sortBy, busId, isActive } = query;

    const where: Prisma.RotationWhereInput = {
      ...(busId && { busId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rotation.findMany({
        where,
        orderBy: [{ [sortBy]: order }, { id: order }],
        take: limit,
        skip: (page - 1) * limit,
        include: {
          bus: { select: { id: true, plate: true } },
          _count: { select: { legs: true } },
        },
      }),
      this.prisma.rotation.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: number) {
    const rotation = await this.prisma.rotation.findUnique({
      where: { id },
      include: { ...rotationInclude, _count: { select: { trips: true } } },
    });

    if (!rotation) throw new NotFoundException(`Rotación con id #${id} no existe`);
    return rotation;
  }

  async update(id: number, dto: UpdateRotationDto) {
    const { name, legs } = dto;

    if (name === undefined && legs === undefined) {
      throw new BadRequestException('Debe enviar name o legs para actualizar');
    }

    await this.findOne(id);

    const detachedTrips = await this.prisma
      .$transaction(async (tx) => {
        if (name !== undefined) {
          await tx.rotation.update({ where: { id }, data: { name } });
        }
        if (legs === undefined) return 0;

        await this.assertLegs(tx, legs, id);
        await tx.rotationLeg.deleteMany({ where: { rotationId: id } });
        await tx.rotationLeg.createMany({
          data: legs.map(({ frequencyId, weekday }) => ({ frequencyId, weekday, rotationId: id })),
        });

        return this.detachStaleTrips(tx, id, legs);
      }, TX_OPTIONS)
      .catch(rethrowRotationConflict);

    return { ...(await this.findOne(id)), detachedTrips };
  }

  async updateActive(id: number, isActive: boolean) {
    const rotation = await this.findOne(id);

    if (rotation.isActive === isActive) {
      throw new ConflictException(`La rotación ya está ${isActive ? 'activa' : 'inactiva'}`);
    }

    await this.prisma
      .$transaction(async (tx) => {
        if (isActive && rotation.busId !== null) {
          await this.assertBusUsable(tx, rotation.busId, id);
        }
        await tx.rotation.update({ where: { id }, data: { isActive } });
      }, TX_OPTIONS)
      .catch(rethrowRotationConflict);

    return this.findOne(id);
  }

  async remove(id: number) {
    const { _count } = await this.findOne(id);

    const deleted = await this.prisma.rotation.delete({ where: { id } });

    return { ...deleted, detachedTrips: _count.trips };
  }

  async changeBus(id: number, dto: ChangeRotationBusDto) {
    const { busId, applyFrom } = dto;
    const zone = envs.app_timezone;
    const from = applyFrom ? parseLocalDate(applyFrom, zone) : undefined;

    if (from && !from.isValid) {
      throw new BadRequestException('applyFrom: Debe ser una fecha válida (YYYY-MM-DD)');
    }
    if (from && from < todayIn(zone)) {
      throw new BadRequestException('applyFrom: No puede ser anterior a hoy');
    }

    const result = await this.prisma
      .$transaction(async (tx) => {
        const rotation = await tx.rotation.findUnique({
          where: { id },
          select: {
            id: true,
            isActive: true,
            legs: { select: { frequencyId: true, weekday: true } },
          },
        });
        if (!rotation) throw new NotFoundException(`Rotación con id #${id} no existe`);

        const bus =
          busId === null ? null : await this.assertBusUsable(tx, busId, id, rotation.isActive);
        await tx.rotation.update({ where: { id }, data: { busId } });

        if (!from) return { reassigned: 0, unassigned: [] };
        return this.reassignTrips(tx, id, bus, rotation.legs, from.toJSDate());
      }, TX_OPTIONS)
      .catch((error) => {
        if (isBusOverlapViolation(error)) rethrowBusOverlap(error);
        rethrowRotationConflict(error);
      });

    return { rotation: await this.findOne(id), ...result };
  }

  private async reassignTrips(
    tx: Tx,
    rotationId: number,
    bus: { id: number; plate: string } | null,
    legs: { frequencyId: number; weekday: Weekday }[],
    from: Date,
  ) {
    const zone = envs.app_timezone;
    const keys = new Set(legs.map(legKey));

    const candidates = await tx.trip.findMany({
      where: {
        status: TripStatus.SCHEDULED,
        scheduledDeparture: { gte: from },
        frequencyId: { in: legs.map((l) => l.frequencyId) },
        OR: [{ rotationId }, { busId: null, rotationId: null }],
      },
      select: {
        id: true,
        frequencyId: true,
        scheduledDeparture: true,
        scheduledArrival: true,
        route: { select: labeledRouteSelect },
      },
      orderBy: { scheduledDeparture: 'asc' },
    });

    const trips = candidates.filter(
      (t) =>
        t.frequencyId !== null &&
        keys.has(
          legKey({ frequencyId: t.frequencyId, weekday: weekdayOf(t.scheduledDeparture, zone) }),
        ),
    );
    if (trips.length === 0) return { reassigned: 0, unassigned: [] };

    await tx.trip.updateMany({
      where: { id: { in: trips.map((t) => t.id) } },
      data: { busId: null, rotationId },
    });

    const toUnassigned = (
      trip: { id: number; frequencyId: number | null; scheduledDeparture: Date },
      reason: UnassignedReason,
    ): RotationTripUnassigned => ({
      tripId: trip.id,
      frequencyId: trip.frequencyId,
      scheduledDeparture: trip.scheduledDeparture,
      ...reason,
    });

    if (bus === null) {
      const reason = {
        code: UnassignedCode.ROTATION_NO_BUS,
        message: 'La rotación no tiene bus asignado',
      };
      return { reassigned: 0, unassigned: trips.map((t) => toUnassigned(t, reason)) };
    }

    const timelines = await this.busAssignment.loadBusTimelines(
      tx,
      [bus.id],
      DateTime.fromJSDate(trips[0].scheduledDeparture),
      DateTime.fromJSDate(trips[trips.length - 1].scheduledDeparture),
    );

    const plan = planBusAssignments(
      trips.map((t) => ({ ...t, bus, route: toLabeledRoute(t.route) })),
      timelines,
      envs.turnaround_minutes,
    );

    // TODO: cuando existan tickets, cambiar de bus exigirá remapear asientos por número
    const { count } = await tx.trip.updateMany({
      where: { id: { in: plan.accepted.map((t) => t.id) } },
      data: { busId: bus.id },
    });

    const unassigned = plan.rejected
      .map(({ candidate, reason }) => toUnassigned(candidate, reason))
      .sort((a, b) => a.scheduledDeparture.getTime() - b.scheduledDeparture.getTime());

    return { reassigned: count, unassigned };
  }

  /** Los viajes futuros de la rotación que ya no coinciden con sus legs dejan de pertenecer a ella */
  private async detachStaleTrips(tx: Tx, rotationId: number, legs: RotationLegDto[]) {
    const keys = new Set(legs.map(legKey));

    const trips = await tx.trip.findMany({
      where: {
        rotationId,
        status: TripStatus.SCHEDULED,
        scheduledDeparture: { gte: new Date() },
      },
      select: { id: true, frequencyId: true, scheduledDeparture: true },
    });

    const stale = trips.filter(
      (t) =>
        t.frequencyId === null ||
        !keys.has(
          legKey({
            frequencyId: t.frequencyId,
            weekday: weekdayOf(t.scheduledDeparture, envs.app_timezone),
          }),
        ),
    );
    if (stale.length === 0) return 0;

    const { count } = await tx.trip.updateMany({
      where: { id: { in: stale.map((t) => t.id) } },
      data: { rotationId: null },
    });
    return count;
  }

  private async assertLegs(tx: Tx, legs: RotationLegDto[], excludeRotationId?: number) {
    const ids = [...new Set(legs.map((l) => l.frequencyId))];

    const frequencies = await tx.frequency.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        isActive: true,
        weekdays: true,
        departureTime: true,
        route: {
          select: {
            originId: true,
            destinationId: true,
            durationMinutes: true,
            origin: terminalLabelSelect,
            destination: terminalLabelSelect,
          },
        },
      },
    });

    const byId = new Map(frequencies.map((f) => [f.id, f]));
    const missing = ids.filter((fid) => !byId.has(fid));
    if (missing.length > 0) {
      throw new BadRequestException(`Las frecuencias no existen: ${missing.join(', ')}`);
    }

    const cycle: CycleLeg[] = legs.map((leg) => {
      const f = byId.get(leg.frequencyId)!;
      return {
        frequencyId: f.id,
        weekday: leg.weekday,
        departureMinutes: minutesOfDay(f.departureTime),
        durationMinutes: f.route.durationMinutes,
        originId: f.route.originId,
        destinationId: f.route.destinationId,
        originLabel: label(f.route.origin),
        destinationLabel: label(f.route.destination),
        frequencyWeekdays: f.weekdays,
        frequencyActive: f.isActive,
      };
    });

    assertValidCycle(cycle, envs.turnaround_minutes);

    const taken = await tx.rotationLeg.findFirst({
      where: {
        OR: legs.map(({ frequencyId, weekday }) => ({ frequencyId, weekday })),
        ...(excludeRotationId && { rotationId: { not: excludeRotationId } }),
      },
      select: { frequencyId: true, weekday: true, rotation: { select: { id: true, name: true } } },
    });

    if (taken) {
      throw new ConflictException(
        `La frecuencia #${taken.frequencyId} del ${WEEKDAY_LABEL[taken.weekday]} ya está cubierta ` +
          `por la rotación #${taken.rotation.id} (${taken.rotation.name})`,
      );
    }
  }

  /** El bus existe, no está fuera de servicio y no pertenece a otra rotación activa */
  private async assertBusUsable(
    tx: Tx,
    busId: number,
    excludeRotationId?: number,
    requireFree = true,
  ) {
    const [bus] = await tx.$queryRaw<{ id: number; plate: string; status: BusStatus }[]>`
      SELECT id, plate, status FROM "Bus" WHERE id = ${busId} FOR UPDATE`;

    if (!bus) throw new BadRequestException(`El bus con id ${busId} no existe`);
    if (bus.status === BusStatus.OUT_OF_SERVICE) {
      throw new ConflictException(`El bus ${bus.plate} está fuera de servicio`);
    }

    if (!requireFree) return bus;

    const other = await tx.rotation.findFirst({
      where: {
        busId,
        isActive: true,
        ...(excludeRotationId && { id: { not: excludeRotationId } }),
      },
      select: { id: true, name: true },
    });

    if (other) {
      throw new ConflictException(
        `El bus ${bus.plate} ya pertenece a la rotación activa #${other.id} (${other.name})`,
      );
    }

    return bus;
  }
}
