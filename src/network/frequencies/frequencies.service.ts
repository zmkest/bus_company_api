import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateFrequencyDto } from './dto/create-frequency.dto.js';
import { UpdateFrequencyDto } from './dto/update-frequency.dto.js';
import { FindFrequenciesQueryDto } from './dto/find-frequencies-query.dto.js';
import { Weekday } from '../../generated/prisma/enums.js';
import { paginate } from '../../common/interfaces/paginated.js';

const WEEKDAY_ORDER = Object.values(Weekday);

const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

const sortWeekdays = (weekdays: Weekday[]) =>
  [...weekdays].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));

const terminalSelect = {
  select: { id: true, name: true, city: { select: { id: true, name: true } } },
} as const;

const routeSummary = {
  select: { id: true, origin: terminalSelect, destination: terminalSelect },
} as const;

@Injectable()
export class FrequenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFrequencyDto) {
    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
      select: { id: true },
    });
    if (!route) {
      throw new BadRequestException(`La ruta con id ${dto.routeId} no existe`);
    }

    const departureTime = toTime(dto.departureTime);
    const weekdays = sortWeekdays(dto.weekdays);

    await this.assertNoOverlap(dto.routeId, departureTime, weekdays);

    return this.prisma.frequency.create({
      data: { routeId: dto.routeId, departureTime, weekdays, basePrice: dto.basePrice },
    });
  }

  async findAll(query: FindFrequenciesQueryDto) {
    const { limit, page, order, sortBy, routeId, weekday, isActive } = query;

    const where: Prisma.FrequencyWhereInput = {
      ...(routeId && { routeId }),
      ...(weekday && { weekdays: { has: weekday } }),
      ...(isActive !== undefined && { isActive }),
    };

    const orderBy: Prisma.FrequencyOrderByWithRelationInput[] = [
      { [sortBy]: order },
      { id: order },
    ];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.frequency.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
        include: { route: routeSummary },
      }),
      this.prisma.frequency.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: number) {
    const frequency = await this.prisma.frequency.findUnique({
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
        _count: { select: { trips: true } },
      },
    });

    if (!frequency) throw new NotFoundException(`Frecuencia con id #${id} no existe`);
    return frequency;
  }

  async update(id: number, dto: UpdateFrequencyDto) {
    const { departureTime, weekdays, basePrice } = dto;

    if (departureTime === undefined && weekdays === undefined && basePrice === undefined) {
      throw new BadRequestException(
        'Debe enviar departureTime, weekdays o basePrice para actualizar',
      );
    }

    const current = await this.findOne(id);

    const newTime = departureTime !== undefined ? toTime(departureTime) : current.departureTime;
    const newWeekdays = weekdays !== undefined ? sortWeekdays(weekdays) : current.weekdays;

    if (departureTime !== undefined || weekdays !== undefined) {
      await this.assertNoOverlap(current.routeId, newTime, newWeekdays, id);
    }

    return this.prisma.frequency.update({
      where: { id },
      data: {
        departureTime: newTime,
        weekdays: newWeekdays,
        ...(basePrice !== undefined && { basePrice }),
      },
      include: { route: routeSummary },
    });
  }

  async updateActive(id: number, isActive: boolean) {
    const frequency = await this.findOne(id);

    if (frequency.isActive === isActive) {
      throw new ConflictException(`La frecuencia ya está ${isActive ? 'activa' : 'inactiva'}`);
    }

    return this.prisma.frequency.update({
      where: { id },
      data: { isActive },
      include: { route: routeSummary },
    });
  }

  async remove(id: number) {
    const { _count } = await this.findOne(id);

    const deleted = await this.prisma.frequency.delete({ where: { id } });

    return { ...deleted, detachedTrips: _count.trips };
  }

  private async assertNoOverlap(
    routeId: number,
    departureTime: Date,
    weekdays: Weekday[],
    excludeId?: number,
  ) {
    const clash = await this.prisma.frequency.findFirst({
      where: {
        routeId,
        departureTime,
        weekdays: { hasSome: weekdays },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true, weekdays: true },
    });

    if (clash) {
      const shared = weekdays.filter((d) => clash.weekdays.includes(d));
      throw new ConflictException(
        `Ya existe la frecuencia #${clash.id} en esta ruta a la misma hora para: ${shared.join(', ')}`,
      );
    }
  }
}
