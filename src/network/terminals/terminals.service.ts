import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTerminalDto } from './dto/create-terminal.dto.js';
import { Prisma } from '../../generated/prisma/client.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { FindTerminalQueryDto } from './dto/find-terminal-query.dto.js';
import { UpdateTerminalDto } from './dto/update-terminal.dto.js';

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
      this.handleWriteError(error, dto.name, dto.cityId, 'crear');
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

  async findOne(id: number) {
    const terminal = await this.prisma.terminal.findUnique({
      where: { id },
      include: { city: true },
    });

    if (!terminal) throw new NotFoundException(`Terminal con id #${id} no existe`);
    return terminal;
  }

  async update(id: number, dto: UpdateTerminalDto) {
    const current = await this.findOne(id);

    try {
      return await this.prisma.terminal.update({
        where: { id },
        data: dto,
        include: { city: true },
      });
    } catch (error) {
      this.handleWriteError(
        error,
        dto.name ?? current.name,
        dto.cityId ?? current.cityId,
        'actualizar',
      );
    }
  }

  private handleWriteError(
    error: unknown,
    name: string,
    cityId: number,
    action: 'crear' | 'actualizar',
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2003':
          throw new BadRequestException(`La ciudad con id ${cityId} no existe`);
        case 'P2002':
          throw new ConflictException(`Ya existe un terminal "${name}" en esta ciudad`);
        case 'P2025':
          throw new NotFoundException('El terminal no existe');
      }
    }

    this.logger.error(`Error inesperado al ${action} terminal`, error as Error);
    throw new InternalServerErrorException(`No se pudo ${action} el terminal`);
  }
}
