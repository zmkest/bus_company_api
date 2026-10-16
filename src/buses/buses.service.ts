import { ConflictException, Injectable } from '@nestjs/common';
import { CreateBusDto } from './dto/create-bus.dto.js';
import { UpdateBusDto } from './dto/update-bus.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FindBusesQueryDto } from './dto/find-buses-query.dto.js';
import { BusStatus, Prisma } from '../generated/prisma/client.js';
import { paginate } from '../common/interfaces/paginated.js';

@Injectable()
export class BusesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBusDto: CreateBusDto) {
    const { plate } = createBusDto;

    const exist = await this.findByPlate(plate);
    if (exist) throw new ConflictException(`El bus con la placa ${plate} ya se encuentra registrado`);

    return this.prisma.bus.create({
      data: createBusDto
    })
  }

  async findAll(query: FindBusesQueryDto) {
    const { order, sortBy, search, limit, page } = query;

    const where: Prisma.BusWhereInput = {
      ...(search && {
        OR: [
          { plate: { contains: search, mode: 'insensitive' }},
          { model: { contains: search, mode: 'insensitive' }},
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

  findOne(id: number) {
    return this.prisma.bus.findFirst({
      where: { id }
    });
  }

  findByPlate(plate: string) {
    return this.prisma.bus.findUnique({
      where: { plate },      
    })
  }

  update(id: number, updateBusDto: UpdateBusDto) {
    return this.prisma.bus.update({
      where: { id },
      data: updateBusDto
    })
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
