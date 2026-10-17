import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FindBusStatusHistoryDto } from './dto/find-status-history.dto.js';
import { BusStatus, Prisma } from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';

@Injectable()
export class StatusHistoryService {

    constructor(
        private readonly prismaService: PrismaService,
    ) { }

    async findOne(id: number) {
        const statusHistory = await this.prismaService.busStatusHistory.findUnique({
            where: { id }
        });

        if (!statusHistory) throw new NotFoundException(`Registro ${id} no existe`);

        return statusHistory;
    }

    async findAll(query: FindBusStatusHistoryDto) {
        const { limit, order, page, sortBy, search } = query;

        const statusMatch = Object.values(BusStatus).find(
            (s) => s.toLowerCase() === search?.toLowerCase()
        );

        const where: Prisma.BusStatusHistoryWhereInput = search
            ? {
                OR: [
                    ...(statusMatch ? [{ fromStatus: statusMatch }] : []),
                    { reason: { contains: search, mode: 'insensitive' } },
                    { changedBy: { name: { contains: search, mode: 'insensitive' } } },
                ]
            } : {}
        const orderBy: Prisma.BusStatusHistoryOrderByWithRelationInput[] = [
            { [sortBy]: order },
            { id: order }
        ];

        const [items, total] = await this.prismaService.$transaction([
            this.prismaService.busStatusHistory.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            this.prismaService.busStatusHistory.count({ where })
        ]);

        return paginate(items, total, page, limit);
    }
}
