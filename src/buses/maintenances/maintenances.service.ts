import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FindMaintenanceQueryDto } from './dto/find-maintenances-query.dto.js';
import {
  BusStatus,
  Maintenance,
  MaintenanceStatus,
  MaintenanceType,
  Prisma,
} from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';

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

  async findOne(id: number, busId?: number): Promise<Maintenance> {
    const m = await this.prisma.maintenance.findUnique({
      where: { id, busId },
    });

    if (!m) throw new NotFoundException(`Mantenimiento con id #${id} no existe`);
    return m;
  }

  async update(id: number, dto: UpdateMaintenanceDto) {
    const { busId, ...data } = dto;

    await this.findOne(id, busId);
    return await this.prisma.maintenance.update({
      data: data,
      where: { id, busId },
    });
  }

  async complete(id: number, userId: number, finishedAt: Date) {
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.maintenance.findUnique({ where: { id } });
      if (!m) throw new NotFoundException('El mantenimiento no existe');

      const { count } = await tx.maintenance.updateMany({
        data: { status: MaintenanceStatus.COMPLETED, finishedAt },
        where: { id, status: MaintenanceStatus.IN_PROGRESS },
      });
      if (count === 0) {
        throw new ConflictException('EL mantenimiento no está en curso');
      }

      await tx.busStatusHistory.create({
        data: {
          busId: m.busId,
          fromStatus: BusStatus.MAINTENANCE,
          toStatus: BusStatus.AVAILABLE,
          changedById: userId,
          reason: 'Mantenimiento completado',
        },
      });

      await tx.bus.update({
        data: {
          status: BusStatus.AVAILABLE,
        },
        where: { id: m.busId },
      });
    });
  }

  async cancel(id: number, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const m = await tx.maintenance.findUnique({ where: { id } });
      if (!m) throw new NotFoundException('El mantenimiento no existe');

      const { count } = await tx.maintenance.updateMany({
        data: { status: MaintenanceStatus.CANCELLED, finishedAt: new Date() },
        where: { id, status: MaintenanceStatus.IN_PROGRESS },
      });
      if (count === 0) {
        throw new ConflictException('EL mantenimiento no está en curso');
      }

      const origin = await tx.busStatusHistory.findFirst({
        where: { busId: m.busId, toStatus: BusStatus.MAINTENANCE },
        orderBy: { createdAt: 'desc' },
      });
      if (!origin) {
        throw new NotFoundException('No se encontró el estado previo del bus');
      }

      await tx.busStatusHistory.create({
        data: {
          busId: m.busId,
          fromStatus: BusStatus.MAINTENANCE,
          toStatus: origin.fromStatus,
          changedById: userId,
          reason: 'Mantenimiento cancelado',
        },
      });

      await tx.bus.update({
        data: {
          status: origin.fromStatus,
        },
        where: { id: m.busId },
      });
    });
  }
}
