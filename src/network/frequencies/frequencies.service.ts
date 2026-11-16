import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateFrequencyDto } from './dto/create-frequency.dto.js';
import { FindFrequenciesQueryDto } from './dto/find-frequencies-query.dto.js';
import { Weekday } from '../../generated/prisma/enums.js';
import { paginate } from '../../common/interfaces/paginated.js';

const WEEKDAY_ORDER = Object.values(Weekday);

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
        departureTime: new Date(`1970-01-01T${dto.departureTime}:00Z`),
        weekdays: [...dto.weekdays].sort(
          (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
        ),
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
}
