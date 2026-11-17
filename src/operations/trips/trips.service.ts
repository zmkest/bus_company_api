import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
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

const terminalSelect = {
  select: { id: true, name: true, city: { select: { id: true, name: true } } },
} as const;

const tripInclude = {
  route: { select: { id: true, origin: terminalSelect, destination: terminalSelect } },
  bus: { select: { id: true, plate: true, model: true } },
} as const;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTripDto) {
    const { routeId, busId, scheduledDeparture, price } = dto;

    const [route, bus] = await Promise.all([
      this.prisma.route.findUnique({
        where: { id: routeId },
        select: { id: true, durationMinutes: true },
      }),
      this.prisma.bus.findUnique({ where: { id: busId }, select: { id: true } }),
    ]);

    if (!route) throw new BadRequestException(`La ruta con id ${routeId} no existe`);
    if (!bus) throw new BadRequestException(`El bus con id ${busId} no existe`);

    const scheduledArrival = addMinutes(scheduledDeparture, route.durationMinutes);

    return this.prisma.trip.create({
      data: {
        routeId,
        busId,
        scheduledDeparture,
        scheduledArrival,
        estimatedArrival: scheduledArrival,
        durationMinutes: route.durationMinutes,
        price,
      },
      include: tripInclude,
    });
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
}
