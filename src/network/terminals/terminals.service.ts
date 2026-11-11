import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTerminalDto } from './dto/create-terminal.dto.js';
import { Prisma } from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { FindTerminalQueryDto } from './dto/find-terminal-query.dto.js';

@Injectable()
export class TerminalsService {
  private readonly logger = new Logger(TerminalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTerminalDto) {
    try {
      return await this.prisma.terminal.create({
        data: dto,
        include: { city: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2003':
            throw new BadRequestException(`La ciudad con id ${dto.cityId} no existe`);
          case 'P2002':
            throw new ConflictException(`Ya existe un terminal "${dto.name}" en esta ciudad`);
        }
      }

      this.logger.error('Error inesperado al crear terminal', error as Error);
      throw new InternalServerErrorException('No se pudo crear el terminal');
    }
  }

  async findAll(query: FindTerminalQueryDto) {
    const { limit, page, order, search, sortBy } = query;

    const where: Prisma.TerminalWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const orderBy: Prisma.TerminalOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: order }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.terminal.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.terminal.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }
}
