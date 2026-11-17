import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BusStatus, TripStatus } from '../../generated/prisma/enums.js';
import { DateTime } from 'luxon';
import { UnassignedCode, UnassignedReason } from './bus-assignment/assignment-conflict.js';
import { label, TerminalLabel, terminalLabelSelect } from './bus-assignment/assignment-messages.js';
import {
  BusCandidate,
  LabeledRoute,
  planBusAssignments,
  TimelineTrip,
} from './bus-assignment/bus-schedule.planner.js';
import { envs } from '../../config/envs.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { GenerateTripsDto } from './dto/generate-trips.dto.js';
import {
  addMinutes,
  assertGenerationRange,
  buildDepartures,
  parseLocalDate,
  todayIn,
} from './common/trip-schedule.util.js';
import { BusAssignmentService } from './bus-assignment/bus-assignment.service.js';
import { rethrowBusOverlap } from './common/prisma-errors.util.js';
import { FindTripsQueryDto } from './dto/find-trips-query.dto.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { SearchTripsQueryDto } from './dto/search-trips-query.dto.js';
import { seatCountsSelect, seatsLeft } from './common/seats.util.js';

const terminalSelect = {
  select: { id: true, name: true, city: { select: { id: true, name: true } } },
} as const;

const publicTerminalSelect = {
  select: {
    id: true,
    name: true,
    address: true,
    city: { select: { id: true, name: true } },
  },
} as const;

// La base es remota: margen para transacciones con varias consultas
const TX_OPTIONS = { timeout: 15_000 } as const;
const GENERATE_TX_OPTIONS = { timeout: 30_000 } as const;

const labeledRouteSelect = {
  originId: true,
  destinationId: true,
  durationMinutes: true,
  origin: terminalLabelSelect,
  destination: terminalLabelSelect,
} as const;

const toLabeledRoute = (route: {
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

const tripKey = (frequencyId: number, departure: Date) => `${frequencyId}:${departure.getTime()}`;

interface Candidate {
  key: string;
  route: LabeledRoute;
  rotation?: { id: number; bus: { id: number; plate: string; status: BusStatus } | null };
  data: Prisma.TripCreateManyInput & { busId: number | null };
}

export interface GeneratedUnassigned extends UnassignedReason {
  frequencyId: number;
  scheduledDeparture: Date;
}

export interface GenerateTripsResult {
  created: number;
  skipped: number;
  assigned: number;
  unassigned: GeneratedUnassigned[];
}

const tripInclude = {
  route: { select: { id: true, origin: terminalSelect, destination: terminalSelect } },
  bus: { select: { id: true, plate: true, model: true } },
} as const;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly busAssignment: BusAssignmentService,
  ) {}

  async create(dto: CreateTripDto) {
    const { routeId, busId, scheduledDeparture, price } = dto;

    const [route, bus] = await Promise.all([
      this.prisma.route.findUnique({
        where: { id: routeId },
        select: { id: true, originId: true, destinationId: true, durationMinutes: true },
      }),
      this.prisma.bus.findUnique({ where: { id: busId }, select: { id: true } }),
    ]);

    if (!route) throw new BadRequestException(`La ruta con id ${routeId} no existe`);
    if (!bus) throw new BadRequestException(`El bus con id ${busId} no existe`);

    const scheduledArrival = addMinutes(scheduledDeparture, route.durationMinutes);

    return this.prisma
      .$transaction(async (tx) => {
        await this.busAssignment.assertCanAssign(tx, busId, {
          scheduledDeparture,
          scheduledArrival,
          route,
        });

        return tx.trip.create({
          data: {
            routeId,
            busId,
            scheduledDeparture,
            scheduledArrival,
            estimatedArrival: scheduledArrival,
            durationMinutes: route.durationMinutes,
            price,
          },
          select: { id: true },
        });
      }, TX_OPTIONS)
      .catch(rethrowBusOverlap)
      .then(({ id }) =>
        this.prisma.trip.findUniqueOrThrow({ where: { id }, include: tripInclude }),
      );
  }

  async findAll(query: FindTripsQueryDto) {
    const { limit, page, order, sortBy, routeId, busPlate, status, unassigned } = query;

    if (unassigned && busPlate) {
      throw new BadRequestException('No se puede filtrar por busPlate con unassigned=true');
    }

    const zone = envs.app_timezone;
    const from = query.from ? parseLocalDate(query.from, zone) : undefined;
    const to = query.to ? parseLocalDate(query.to, zone) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException('from: Debe ser menor o igual a to');
    }

    const where: Prisma.TripWhereInput = {
      ...(routeId && { routeId }),
      ...(status && { status }),
      ...(busPlate && { bus: { plate: { contains: busPlate, mode: 'insensitive' } } }),
      ...(unassigned !== undefined && { busId: unassigned ? null : { not: null } }),
      ...((from || to) && {
        scheduledDeparture: {
          ...(from && { gte: from.toJSDate() }),
          ...(to && { lt: to.plus({ days: 1 }).toJSDate() }),
        },
      }),
    };

    const orderBy: Prisma.TripOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: order }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
        include: tripInclude,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /** Búsqueda pública: viajes programados con bus y asientos libres en una fecha local */
  async search({ originCityId, destinationCityId, date }: SearchTripsQueryDto) {
    if (originCityId === destinationCityId) {
      throw new BadRequestException('La ciudad de origen y destino no pueden ser la misma');
    }

    const zone = envs.app_timezone;
    const day = parseLocalDate(date, zone);
    if (!day.isValid) throw new BadRequestException('date: Debe ser una fecha válida (YYYY-MM-DD)');
    if (day < todayIn(zone)) throw new BadRequestException('date: No puede ser anterior a hoy');

    const now = new Date();
    const dayStart = day.toJSDate();

    const trips = await this.prisma.trip.findMany({
      where: {
        status: TripStatus.SCHEDULED,
        busId: { not: null },
        route: {
          origin: { cityId: originCityId },
          destination: { cityId: destinationCityId },
        },
        scheduledDeparture: {
          gte: dayStart > now ? dayStart : now,
          lt: day.plus({ days: 1 }).toJSDate(),
        },
      },
      select: {
        id: true,
        scheduledDeparture: true,
        scheduledArrival: true,
        durationMinutes: true,
        price: true,
        route: {
          select: {
            id: true,
            distanceKm: true,
            origin: publicTerminalSelect,
            destination: publicTerminalSelect,
          },
        },
        ...seatCountsSelect(now),
      },
      orderBy: [{ scheduledDeparture: 'asc' }, { id: 'asc' }],
    });

    return trips
      .map(({ bus, _count, ...trip }) => ({ ...trip, seatsLeft: seatsLeft({ bus, _count }) ?? 0 }))
      .filter((trip) => trip.seatsLeft > 0);
  }

  async generate(dto: GenerateTripsDto): Promise<GenerateTripsResult> {
    const zone = envs.app_timezone;
    const from = parseLocalDate(dto.from, zone);
    const to = parseLocalDate(dto.to, zone);

    assertGenerationRange(from, to, todayIn(zone));

    const frequencies = await this.prisma.frequency.findMany({
      where: {
        isActive: true,
        ...(dto.routeId && { routeId: dto.routeId }),
        ...(dto.frequencyIds && { id: { in: dto.frequencyIds } }),
      },
      select: {
        id: true,
        routeId: true,
        departureTime: true,
        weekdays: true,
        basePrice: true,
        route: { select: labeledRouteSelect },
        rotationLegs: {
          select: {
            weekday: true,
            rotation: {
              select: {
                id: true,
                isActive: true,
                bus: { select: { id: true, plate: true, status: true } },
              },
            },
          },
        },
      },
    });

    const candidates: Candidate[] = frequencies.flatMap((f) => {
      const route = toLabeledRoute(f.route);
      return buildDepartures(f.departureTime, f.weekdays, from, to).map(
        ({ scheduledDeparture, weekday }) => {
          const scheduledArrival = addMinutes(scheduledDeparture, f.route.durationMinutes);
          const rotation = f.rotationLegs.find((l) => l.weekday === weekday)?.rotation;
          return {
            key: tripKey(f.id, scheduledDeparture),
            route,
            rotation: rotation?.isActive ? rotation : undefined,
            data: {
              routeId: f.routeId,
              frequencyId: f.id,
              busId: null,
              rotationId: rotation?.isActive ? rotation.id : null,
              scheduledDeparture,
              scheduledArrival,
              estimatedArrival: scheduledArrival,
              durationMinutes: f.route.durationMinutes,
              price: f.basePrice,
            },
          };
        },
      );
    });

    if (candidates.length === 0) return { created: 0, skipped: 0, assigned: 0, unassigned: [] };

    return this.prisma
      .$transaction((tx) => this.insertCandidates(tx, candidates, from, to), GENERATE_TX_OPTIONS)
      .catch(rethrowBusOverlap);
  }

  /**
   * createMany({ skipDuplicates }) usa ON CONFLICT DO NOTHING sin target, que también ignora
   * la exclusion constraint. Por eso los duplicados se descartan antes, los buses se validan
   * en memoria y lo que la base no inserte se revisa después.
   */
  private async insertCandidates(
    tx: Prisma.TransactionClient,
    all: Candidate[],
    from: DateTime,
    to: DateTime,
  ): Promise<GenerateTripsResult> {
    const busIds = [
      ...new Set(all.flatMap((c) => (c.rotation?.bus ? [c.rotation.bus.id] : []))),
    ].sort((a, b) => a - b);

    if (busIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM "Bus" WHERE id IN (${Prisma.join(busIds)}) ORDER BY id FOR UPDATE`;
    }

    const existingKeys = await this.findExistingKeys(
      tx,
      all.map((c) => c.data),
      from.toJSDate(),
      to.plus({ days: 1 }).toJSDate(),
    );
    const candidates = all.filter((c) => !existingKeys.has(c.key));
    let skipped = all.length - candidates.length;

    const unassigned: GeneratedUnassigned[] = [];
    const report = (c: Candidate, reason: UnassignedReason) =>
      unassigned.push({
        frequencyId: c.data.frequencyId!,
        scheduledDeparture: c.data.scheduledDeparture as Date,
        ...reason,
      });

    const withBus: (Candidate & BusCandidate)[] = [];
    for (const c of candidates) {
      const rotation = c.rotation;
      if (!rotation) continue;
      if (!rotation.bus) {
        report(c, {
          code: UnassignedCode.ROTATION_NO_BUS,
          message: `La rotación #${rotation.id} no tiene bus asignado`,
        });
      } else if (rotation.bus.status === BusStatus.OUT_OF_SERVICE) {
        report(c, {
          code: UnassignedCode.BUS_OUT_OF_SERVICE,
          message: `El bus ${rotation.bus.plate} está fuera de servicio`,
        });
      } else {
        withBus.push({
          ...c,
          bus: rotation.bus,
          scheduledDeparture: c.data.scheduledDeparture as Date,
          scheduledArrival: c.data.scheduledArrival as Date,
        });
      }
    }

    const plan = planBusAssignments(
      withBus,
      await this.loadBusTimelines(tx, busIds, from, to),
      envs.turnaround_minutes,
    );
    plan.accepted.forEach((c) => (c.data.busId = c.bus.id));
    plan.rejected.forEach(({ candidate, reason }) => report(candidate, reason));

    const sent = candidates.map((c) => c.data);
    const inserted = await tx.trip.createManyAndReturn({
      data: sent,
      skipDuplicates: true,
      select: { frequencyId: true, scheduledDeparture: true, busId: true },
    });

    if (inserted.length < sent.length) {
      const insertedKeys = new Set(
        inserted.map((t) => tripKey(t.frequencyId!, t.scheduledDeparture)),
      );
      const missing = candidates.filter((c) => !insertedKeys.has(c.key));
      const concurrent = await this.findExistingKeys(
        tx,
        missing.map((c) => c.data),
        from.toJSDate(),
        to.plus({ days: 1 }).toJSDate(),
      );

      const retry = missing.filter((c) => !concurrent.has(c.key));
      skipped += missing.length - retry.length;

      if (retry.length > 0) {
        retry.forEach((c) => {
          if (c.data.busId !== null) {
            report(c, {
              code: UnassignedCode.DB_CONFLICT,
              message: 'La base rechazó la asignación por un choque de horario del bus',
            });
          }
          c.data.busId = null;
        });
        const again = await tx.trip.createManyAndReturn({
          data: retry.map((c) => c.data),
          skipDuplicates: true,
          select: { frequencyId: true, scheduledDeparture: true, busId: true },
        });
        skipped += retry.length - again.length;
        inserted.push(...again);
      }
    }

    unassigned.sort((a, b) => a.scheduledDeparture.getTime() - b.scheduledDeparture.getTime());

    return {
      created: inserted.length,
      skipped,
      assigned: inserted.filter((t) => t.busId !== null).length,
      unassigned,
    };
  }

  private async findExistingKeys(
    tx: Prisma.TransactionClient,
    data: Prisma.TripCreateManyInput[],
    from: Date,
    to: Date,
  ) {
    if (data.length === 0) return new Set<string>();

    const existing = await tx.trip.findMany({
      where: {
        frequencyId: { in: [...new Set(data.map((d) => d.frequencyId!))] },
        scheduledDeparture: { gte: from, lt: to },
      },
      select: { frequencyId: true, scheduledDeparture: true },
    });

    return new Set(existing.map((t) => tripKey(t.frequencyId!, t.scheduledDeparture)));
  }

  /** Viajes no cancelados de cada bus alrededor del rango, más el vecino inmediato en cada borde */
  private async loadBusTimelines(
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

  async assignBus(id: number, busId: number | null) {
    return this.prisma
      .$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            scheduledDeparture: true,
            scheduledArrival: true,
            route: { select: { originId: true, destinationId: true } },
          },
        });

        if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
        if (trip.status !== TripStatus.SCHEDULED) {
          throw new ConflictException(
            `Solo se puede cambiar el bus de un viaje SCHEDULED (estado actual: ${trip.status})`,
          );
        }

        if (busId !== null) await this.busAssignment.assertCanAssign(tx, busId, trip);

        // TODO: cuando existan tickets, cambiar de bus exigirá remapear asientos por número
        await tx.trip.update({ where: { id }, data: { busId } });
      }, TX_OPTIONS)
      .catch(rethrowBusOverlap)
      .then(() => this.prisma.trip.findUniqueOrThrow({ where: { id }, include: tripInclude }));
  }
}
