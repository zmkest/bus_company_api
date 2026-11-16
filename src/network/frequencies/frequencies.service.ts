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

    return this.prisma.frequency.create({
      data: {
        routeId: dto.routeId,
        departureTime: toTime(dto.departureTime),
        weekdays: sortWeekdays(dto.weekdays),
        basePrice: dto.basePrice,
      },
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

    await this.findOne(id);

    return this.prisma.frequency.update({
      where: { id },
      data: {
        ...(departureTime !== undefined && { departureTime: toTime(departureTime) }),
        ...(weekdays !== undefined && { weekdays: sortWeekdays(weekdays) }),
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
}
