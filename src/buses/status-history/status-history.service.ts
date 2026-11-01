import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FindBusStatusHistoryDto } from './dto/find-status-history.dto.js';
import { BusStatus, Prisma } from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';

@Injectable()
export class StatusHistoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOne(id: number) {
    const statusHistory = await this.prismaService.busStatusHistory.findUnique({
      where: { id },
    });

    if (!statusHistory) throw new NotFoundException(`Registro ${id} no existe`);

    return statusHistory;
  }

  async findAll(query: FindBusStatusHistoryDto) {
    const { limit, order, page, sortBy, search, toStatus, fromStatus } = query;

    const where: Prisma.BusStatusHistoryWhereInput = {
      ...(fromStatus && { fromStatus }),
      ...(toStatus && { toStatus }),
      ...(search && {
        OR: [
          { bus: { plate: { contains: search, mode: 'insensitive' } } },
          { reason: { contains: search, mode: 'insensitive' } },
          { changedBy: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const orderBy: Prisma.BusStatusHistoryOrderByWithRelationInput[] = [
      { [sortBy]: order },
      { id: order },
    ];

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.busStatusHistory.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          changedBy: { select: { name: true } },
          bus: { select: { plate: true } },
        },
      }),
      this.prismaService.busStatusHistory.count({ where }),
    ]);

    const refactorItems = items.map((i) => {
      const { changedBy, bus, ...data } = i;
      return { changedByName: changedBy.name, busPlate: bus.plate, ...data };
    });
    return paginate(refactorItems, total, page, limit);
  }

  async countBytoStatus() {
    const [total, AVAILABLE, MAINTENANCE, ON_ROUTE, OUT_OF_SERVICE] = await Promise.all([
      this.prismaService.busStatusHistory.count(),
      this.prismaService.busStatusHistory.count({
        where: { toStatus: BusStatus.AVAILABLE },
      }),
      this.prismaService.busStatusHistory.count({
        where: { toStatus: BusStatus.MAINTENANCE },
      }),
      this.prismaService.busStatusHistory.count({
        where: { toStatus: BusStatus.ON_ROUTE },
      }),
      this.prismaService.busStatusHistory.count({
        where: { toStatus: BusStatus.OUT_OF_SERVICE },
      }),
    ]);

    return { total, AVAILABLE, MAINTENANCE, ON_ROUTE, OUT_OF_SERVICE };
  }
}
