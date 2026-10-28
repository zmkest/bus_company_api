import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FindMaintenanceQueryDto } from './dto/find-maintenances-query.dto.js';
import { MaintenanceType, Prisma } from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';

@Injectable()
export class MaintenancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: FindMaintenanceQueryDto) {
    const { limit, page, order, sortBy, search, startDate, endDate } = query;
    const conditions: Prisma.MaintenanceWhereInput[] = [];

    if (search) {
      const term = search.trim().toUpperCase().replace(/\s+/g, '_');

      const matchedType = Object.values(MaintenanceType).filter((t) => t.includes(term));
      conditions.push({
        OR: [
          { bus: { plate: { contains: search, mode: 'insensitive' } } },
          ...(matchedType.length ? [{ type: { in: matchedType } }] : []),
        ],
      });
    }

    if (startDate || endDate) {
      conditions.push({
        startedAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lt: new Date(new Date(endDate).getTime() + 86_400_000) }),
        },
      });
    }

    const orderBy: Prisma.MaintenanceOrderByWithRelationInput[] = [
      { [sortBy]: order },
      { id: order },
    ];

    const where = conditions.length ? { AND: conditions } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.maintenance.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }
}
