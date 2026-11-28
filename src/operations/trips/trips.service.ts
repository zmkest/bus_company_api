import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  BusStatus,
  CrewPosition,
  CrewStatus,
  TicketStatus,
  TripStatus,
  UserRole,
} from '../../generated/prisma/enums.js';
import { DateTime } from 'luxon';
import { UnassignedCode, UnassignedReason } from './bus-assignment/assignment-conflict.js';
import {
  BusCandidate,
  LabeledRoute,
  planBusAssignments,
} from './bus-assignment/bus-schedule.planner.js';
import { envs } from '../../config/envs.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { GenerateTripsDto } from './dto/generate-trips.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import {
  addMinutes,
  assertGenerationRange,
  buildDepartures,
  parseLocalDate,
  todayIn,
} from './common/trip-schedule.util.js';
import {
  BusAssignmentService,
  labeledRouteSelect,
  toLabeledRoute,
} from './bus-assignment/bus-assignment.service.js';
import { rethrowBusOverlap } from './common/prisma-errors.util.js';
import { FindTripsQueryDto } from './dto/find-trips-query.dto.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { SearchTripsQueryDto } from './dto/search-trips-query.dto.js';
import {
  occupyingTicketWhere,
  SeatMapStatus,
  seatCountsSelect,
  seatMapStatus,
  seatsLeft,
} from './common/seats.util.js';
import { FindAssignedTripsQueryDto } from './dto/find-assigned-trips-query.dto.js';

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

/** Un DRIVER solo puede operar sobre los viajes a los que está asignado */
const assertCrewAccess = (
  crew: { crewMember: { userId: number | null } }[],
  userId: number,
  role: UserRole,
) => {
  if (role === UserRole.DRIVER && !crew.some((c) => c.crewMember.userId === userId)) {
    throw new ForbiddenException('No estás asignado a este viaje');
  }
};

// La base es remota: margen para transacciones con varias consultas
const TX_OPTIONS = { timeout: 15_000 } as const;
const GENERATE_TX_OPTIONS = { timeout: 30_000 } as const;

// Antelación máxima con la que se puede iniciar un viaje respecto a su salida programada
const START_WINDOW_MINUTES = 60;

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

  async findOne(id: number) {
    const now = new Date();
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        route: {
          select: {
            id: true,
            distanceKm: true,
            durationMinutes: true,
            origin: terminalSelect,
            destination: terminalSelect,
          },
        },
        bus: {
          select: {
            id: true,
            plate: true,
            model: true,
            status: true,
            _count: { select: { seats: { where: { isOperational: true } } } },
          },
        },
        rotation: { select: { id: true, name: true } },
        crew: {
          select: {
            crewMember: {
              select: { id: true, document: true, name: true, position: true, status: true },
            },
          },
          orderBy: { crewMember: { position: 'asc' } },
        },
        _count: { select: { tickets: { where: occupyingTicketWhere(now) } } },
      },
    });

    if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);

    const { bus, crew, _count, ...rest } = trip;
    return {
      ...rest,
      bus: bus && { id: bus.id, plate: bus.plate, model: bus.model, status: bus.status },
      crew: crew.map((c) => c.crewMember),
      totalSeats: bus?._count.seats ?? null,
      seatsLeft: seatsLeft({ bus, _count }),
    };
  }

  async countByStatus() {
    const groups = await this.prisma.trip.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(
      Object.values(TripStatus).map((status) => [status, 0]),
    ) as Record<TripStatus, number>;
    for (const g of groups) counts[g.status] = g._count._all;

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { total, ...counts };
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

  /** Mapa de asientos público de un viaje vendible, sin datos de pasajeros */
  async seatMap(id: number) {
    const now = new Date();
    const trip = await this.prisma.trip.findFirst({
      where: {
        id,
        status: TripStatus.SCHEDULED,
        busId: { not: null },
        scheduledDeparture: { gt: now },
      },
      select: {
        id: true,
        bus: {
          select: {
            seats: {
              select: { id: true, number: true, isOperational: true },
              orderBy: { number: 'asc' },
            },
          },
        },
        tickets: { where: occupyingTicketWhere(now), select: { seatId: true, status: true } },
      },
    });
    if (!trip?.bus)
      throw new NotFoundException(`Viaje con id #${id} no existe o no está disponible`);

    const ticketBySeat = new Map(trip.tickets.map((t) => [t.seatId, t.status]));
    const seats = trip.bus.seats.map((seat) => ({
      number: seat.number,
      status: seatMapStatus(seat.isOperational, ticketBySeat.get(seat.id)),
    }));

    return {
      tripId: trip.id,
      seatsLeft: seats.filter((seat) => seat.status === SeatMapStatus.FREE).length,
      seats,
    };
  }

  /** Lista de embarque: pasajeros con ticket pagado o abordado, ordenados por asiento */
  async manifest(id: number, userId: number, role: UserRole) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        scheduledDeparture: true,
        actualDeparture: true,
        route: { select: { origin: terminalSelect, destination: terminalSelect } },
        bus: { select: { id: true, plate: true } },
        crew: { select: { crewMember: { select: { userId: true } } } },
        tickets: {
          where: { status: { in: [TicketStatus.PAID, TicketStatus.BOARDED] } },
          select: {
            id: true,
            status: true,
            seat: { select: { number: true } },
            passenger: { select: { id: true, document: true, name: true, phone: true } },
          },
          orderBy: { seat: { number: 'asc' } },
        },
      },
    });

    if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
    assertCrewAccess(trip.crew, userId, role);

    const { crew: _crew, tickets, ...rest } = trip;
    const boarded = tickets.filter((t) => t.status === TicketStatus.BOARDED).length;
    return {
      ...rest,
      totalPassengers: tickets.length,
      boarded,
      pending: tickets.length - boarded,
      passengers: tickets.map((t) => ({
        ticketId: t.id,
        seatNumber: t.seat.number,
        status: t.status,
        passenger: t.passenger,
      })),
    };
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
      await this.busAssignment.loadBusTimelines(tx, busIds, from, to),
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

  assignBus(id: number, busId: number | null) {
    return this.update(id, { busId });
  }

  /** Reprograma, cambia el bus o el precio de un viaje SCHEDULED */
  async update(id: number, dto: UpdateTripDto) {
    const { scheduledDeparture, busId, price } = dto;

    if (scheduledDeparture === undefined && busId === undefined && price === undefined) {
      throw new BadRequestException(
        'Debe enviar scheduledDeparture, busId o price para actualizar',
      );
    }

    return this.prisma
      .$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            busId: true,
            frequencyId: true,
            scheduledDeparture: true,
            durationMinutes: true,
            route: { select: { originId: true, destinationId: true } },
          },
        });

        if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
        if (trip.status !== TripStatus.SCHEDULED) {
          throw new ConflictException(
            `Solo se puede modificar un viaje SCHEDULED (estado actual: ${trip.status})`,
          );
        }

        const rescheduled =
          scheduledDeparture !== undefined &&
          scheduledDeparture.getTime() !== trip.scheduledDeparture.getTime();
        const departure = rescheduled ? scheduledDeparture : trip.scheduledDeparture;
        const arrival = addMinutes(departure, trip.durationMinutes);
        const targetBusId = busId === undefined ? trip.busId : busId;

        if (rescheduled && trip.frequencyId !== null) {
          const duplicate = await tx.trip.findFirst({
            where: {
              frequencyId: trip.frequencyId,
              scheduledDeparture: departure,
              id: { not: id },
            },
            select: { id: true },
          });
          if (duplicate) {
            throw new ConflictException(
              `Ya existe el viaje #${duplicate.id} de la misma frecuencia con esa salida`,
            );
          }
        }

        if (targetBusId !== null && (rescheduled || targetBusId !== trip.busId)) {
          await this.busAssignment.assertCanAssign(tx, targetBusId, {
            id,
            scheduledDeparture: departure,
            scheduledArrival: arrival,
            route: trip.route,
          });
        }

        // TODO: cuando existan tickets, cambiar de bus exigirá remapear asientos por número
        await tx.trip.update({
          where: { id },
          data: {
            ...(busId !== undefined && { busId }),
            ...(price !== undefined && { price }),
            ...(rescheduled && {
              scheduledDeparture: departure,
              scheduledArrival: arrival,
              estimatedArrival: arrival,
            }),
          },
        });
      }, TX_OPTIONS)
      .catch(rethrowBusOverlap)
      .then(() => this.prisma.trip.findUniqueOrThrow({ where: { id }, include: tripInclude }));
  }

  /** Inicia un viaje SCHEDULED: IN_PROGRESS, salida real ahora y bus ON_ROUTE con historial */
  async start(id: number, userId: number, role: UserRole) {
    return this.prisma
      .$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            busId: true,
            scheduledDeparture: true,
            durationMinutes: true,
            crew: { select: { crewMember: { select: { userId: true } } } },
          },
        });

        if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
        assertCrewAccess(trip.crew, userId, role);
        if (trip.status !== TripStatus.SCHEDULED) {
          throw new ConflictException(
            `Solo se puede iniciar un viaje SCHEDULED (estado actual: ${trip.status})`,
          );
        }
        if (trip.busId === null) {
          throw new ConflictException('El viaje no tiene bus asignado');
        }

        const now = new Date();
        if (now < addMinutes(trip.scheduledDeparture, -START_WINDOW_MINUTES)) {
          throw new UnprocessableEntityException(
            `Solo se puede iniciar el viaje desde ${START_WINDOW_MINUTES} minutos antes de su salida programada`,
          );
        }

        const [bus] = await tx.$queryRaw<{ plate: string; status: BusStatus }[]>`
          SELECT plate, status FROM "Bus" WHERE id = ${trip.busId} FOR UPDATE`;
        if (bus.status !== BusStatus.AVAILABLE) {
          throw new ConflictException(
            `El bus ${bus.plate} no está disponible (estado actual: ${bus.status})`,
          );
        }

        const { count } = await tx.trip.updateMany({
          where: { id, status: TripStatus.SCHEDULED },
          data: {
            status: TripStatus.IN_PROGRESS,
            actualDeparture: now,
            estimatedArrival: addMinutes(now, trip.durationMinutes),
          },
        });
        if (count === 0) {
          throw new ConflictException('El estado del viaje cambió, intenta de nuevo');
        }

        await tx.bus.update({ where: { id: trip.busId }, data: { status: BusStatus.ON_ROUTE } });
        await tx.busStatusHistory.create({
          data: {
            busId: trip.busId,
            fromStatus: BusStatus.AVAILABLE,
            toStatus: BusStatus.ON_ROUTE,
            changedById: userId,
            reason: `Inicio del viaje #${id}`,
          },
        });
      }, TX_OPTIONS)
      .then(() => this.findOne(id));
  }

  /** Completa un viaje IN_PROGRESS: llegada real ahora, bus AVAILABLE con historial y suma la distancia al odómetro */
  async complete(id: number, userId: number, role: UserRole) {
    return this.prisma
      .$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            busId: true,
            route: { select: { distanceKm: true } },
            crew: { select: { crewMember: { select: { userId: true } } } },
          },
        });

        if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
        assertCrewAccess(trip.crew, userId, role);
        if (trip.status !== TripStatus.IN_PROGRESS) {
          throw new ConflictException(
            `Solo se puede completar un viaje IN_PROGRESS (estado actual: ${trip.status})`,
          );
        }
        if (trip.busId === null) {
          throw new ConflictException('El viaje no tiene bus asignado');
        }

        const [bus] = await tx.$queryRaw<{ plate: string; status: BusStatus }[]>`
          SELECT plate, status FROM "Bus" WHERE id = ${trip.busId} FOR UPDATE`;
        if (bus.status !== BusStatus.ON_ROUTE) {
          throw new ConflictException(
            `El bus ${bus.plate} no está en ruta (estado actual: ${bus.status})`,
          );
        }

        const now = new Date();
        const { count } = await tx.trip.updateMany({
          where: { id, status: TripStatus.IN_PROGRESS },
          data: { status: TripStatus.COMPLETED, actualArrival: now },
        });
        if (count === 0) {
          throw new ConflictException('El estado del viaje cambió, intenta de nuevo');
        }

        await tx.bus.update({
          where: { id: trip.busId },
          data: {
            status: BusStatus.AVAILABLE,
            odometerKm: { increment: Math.round(trip.route.distanceKm) },
          },
        });
        await tx.busStatusHistory.create({
          data: {
            busId: trip.busId,
            fromStatus: BusStatus.ON_ROUTE,
            toStatus: BusStatus.AVAILABLE,
            changedById: userId,
            reason: `Fin del viaje #${id}`,
          },
        });
      }, TX_OPTIONS)
      .then(() => this.findOne(id));
  }

  async findAssignedTripsByDriver(userId: number, query: FindAssignedTripsQueryDto) {
    const { limit, page, status, order, sortBy } = query;
    const driver = await this.prisma.crewMember.findUnique({
      where: { userId: userId, status: CrewStatus.ACTIVE, position: CrewPosition.DRIVER },
      select: { id: true },
    });

    if (!driver) {
      throw new ForbiddenException('No estás habilitado para realizar un viaje');
    }

    const where: Prisma.TripWhereInput = {
      crew: { some: { crewMemberId: driver.id } },
      status: status ?? { in: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS] },
    };

    const orderBy: Prisma.TripOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: order }];

    const [total, trips] = await this.prisma.$transaction([
      this.prisma.trip.count({
        where,
      }),
      this.prisma.trip.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
        include: tripInclude,
      }),
    ]);

    return paginate(trips, total, page, limit);
  }

  /** Cancela un viaje SCHEDULED o IN_PROGRESS: CANCELLED, tickets cancelados y bus AVAILABLE si estaba en ruta */
  async cancel(id: number, userId: number) {
    return this.prisma
      .$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id },
          select: { id: true, status: true, busId: true },
        });

        if (!trip) throw new NotFoundException(`Viaje con id #${id} no existe`);
        if (trip.status !== TripStatus.SCHEDULED && trip.status !== TripStatus.IN_PROGRESS) {
          throw new ConflictException(
            `Solo se puede cancelar un viaje SCHEDULED o IN_PROGRESS (estado actual: ${trip.status})`,
          );
        }

        const { count } = await tx.trip.updateMany({
          where: { id, status: trip.status },
          data: { status: TripStatus.CANCELLED },
        });
        if (count === 0) {
          throw new ConflictException('El estado del viaje cambió, intenta de nuevo');
        }

        if (trip.status === TripStatus.IN_PROGRESS && trip.busId !== null) {
          await this.releaseBus(tx, trip.busId, id, userId);
        }

        await tx.ticket.updateMany({
          where: {
            tripId: id,
            status: { in: [TicketStatus.RESERVED, TicketStatus.PAID, TicketStatus.BOARDED] },
          },
          data: { status: TicketStatus.CANCELLED },
        });
        // TODO: reembolsar pagos de los tickets PAID/BOARDED cuando exista el módulo de pagos
      }, TX_OPTIONS)
      .then(() => this.findOne(id));
  }

  /** Devuelve a AVAILABLE el bus de un viaje cancelado en curso, solo si sigue ON_ROUTE */
  private async releaseBus(
    tx: Prisma.TransactionClient,
    busId: number,
    tripId: number,
    userId: number,
  ) {
    const { count } = await tx.bus.updateMany({
      where: { id: busId, status: BusStatus.ON_ROUTE },
      data: { status: BusStatus.AVAILABLE },
    });
    if (count === 0) return;

    await tx.busStatusHistory.create({
      data: {
        busId,
        fromStatus: BusStatus.ON_ROUTE,
        toStatus: BusStatus.AVAILABLE,
        changedById: userId,
        reason: `Cancelación del viaje #${tripId}`,
      },
    });
  }
}
