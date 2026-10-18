import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBusDto } from './dto/create-bus.dto.js';
import { UpdateBusDto } from './dto/update-bus.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FindBusesQueryDto } from './dto/find-buses-query.dto.js';
import { BusStatus, Prisma } from '../generated/prisma/client.js';
import { paginate } from '../common/interfaces/paginated.js';
import { UpdateBusStatusDto } from './dto/update-status.dto.js';

export const BUS_STATUS_TRANSITIONS: Record<BusStatus, readonly BusStatus[]> = {
  [BusStatus.AVAILABLE]: [BusStatus.ON_ROUTE, BusStatus.MAINTENANCE, BusStatus.OUT_OF_SERVICE],
  [BusStatus.ON_ROUTE]: [BusStatus.AVAILABLE],
  [BusStatus.OUT_OF_SERVICE]: [BusStatus.AVAILABLE],
  [BusStatus.MAINTENANCE]: [BusStatus.AVAILABLE],
}

@Injectable()
export class BusesService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async create(createBusDto: CreateBusDto) {
    const { plate } = createBusDto;

    await this.findByPlate(plate);

    return this.prisma.bus.create({
      data: createBusDto
    })
  }

  async findAll(query: FindBusesQueryDto) {
    const { order, sortBy, search, limit, page } = query;

    const where: Prisma.BusWhereInput = {
      ...(search && {
        OR: [
          { plate: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    const orderBy: Prisma.BusOrderByWithRelationInput[] = [
      { [sortBy]: order },
      { id: order },
    ]

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bus.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.bus.count({ where })
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: number) {
    const bus = await this.prisma.bus.findUnique({
      where: { id }
    });

    if (!bus) throw new NotFoundException(`Bus #${id} no existe`);

    return bus;
  }

  async findByPlate(plate: string) {
    const bus = await this.prisma.bus.findUnique({
      where: { plate },
    });

    if (bus) throw new ConflictException(`El bus con la placa ${plate} ya se encuentra registrado`);
  }

  async update(id: number, updateBusDto: UpdateBusDto) {
    await this.findOne(id);

    return this.prisma.bus.update({
        where: { id },
        data: updateBusDto,
      });
  }
  
  async updateStatusAndHistory(id: number, updateBusStatusDto: UpdateBusStatusDto, userId: number) {
    const { status: toStatus, reason } = updateBusStatusDto;

    return this.prisma.$transaction(async (tx) => {
      const bus = await tx.bus.findUnique({ where: { id } });
      if (!bus) throw new NotFoundException('El bus no existe');

      if (toStatus === bus.status) throw new ConflictException('No puede cambiar al mismo estado');

      const allowed = BUS_STATUS_TRANSITIONS[bus.status];
      if (!allowed.includes(toStatus)) {
        throw new ConflictException(`No se puede pasar de ${bus.status} a ${toStatus}. Permitidos: ${allowed.join(', ') || 'ninguno'}`);
      }

      if ((toStatus === BusStatus.MAINTENANCE || toStatus === BusStatus.OUT_OF_SERVICE) && !reason) {
        throw new ConflictException('Se debe se indicar una razón de este cambio')
      }

      const { count } = await tx.bus.updateMany({
        where: { id, status: bus.status },
        data: { status: toStatus },
      });

      if (count === 0) throw new ConflictException('El estado del bus cambió, intenta de nuevo');

      await tx.busStatusHistory.create({
        data: {
          busId: id,
          fromStatus: bus.status,
          toStatus: toStatus,
          changedById: userId,
          reason
        },
      });
      
      return tx.bus.findUniqueOrThrow({ where: { id }});
    });
  }

  remove(id: number) {
    return this.prisma.bus.delete({
      where: { id }
    })
  }

  count() {
    return this.prisma.bus.count();
  }

  countStatus(status: BusStatus) {
    return this.prisma.bus.count({
      where: { status }
    })
  }
}
