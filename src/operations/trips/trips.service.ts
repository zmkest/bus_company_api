import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TripStatus } from '../../generated/prisma/enums.js';
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

const terminalSelect = {
  select: { id: true, name: true, city: { select: { id: true, name: true } } },
} as const;

// La base es remota: margen para transacciones con varias consultas
const TX_OPTIONS = { timeout: 15_000 } as const;

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

  async generate(dto: GenerateTripsDto) {
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
        route: { select: { durationMinutes: true } },
      },
    });

    const data: Prisma.TripCreateManyInput[] = frequencies.flatMap((f) =>
      buildDepartures(f.departureTime, f.weekdays, from, to).map((scheduledDeparture) => {
        const scheduledArrival = addMinutes(scheduledDeparture, f.route.durationMinutes);
        return {
          routeId: f.routeId,
          frequencyId: f.id,
          busId: null,
          scheduledDeparture,
          scheduledArrival,
          estimatedArrival: scheduledArrival,
          durationMinutes: f.route.durationMinutes,
          price: f.basePrice,
        };
      }),
    );

    if (data.length === 0) return { created: 0, skipped: 0 };

    const { count } = await this.prisma.trip.createMany({ data, skipDuplicates: true });

    return { created: count, skipped: data.length - count };
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
