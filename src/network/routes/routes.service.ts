import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateRouteDto } from './dto/create-route.dto.js';

const terminalWithCity = { include: { city: true } } as const;

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto) {
    const { originId, destinationId } = dto;

    if (originId === destinationId) {
      throw new BadRequestException('El origen y el destino no pueden ser el mismo terminal');
    }

    const terminals = await this.prisma.terminal.findMany({
      where: { id: { in: [originId, destinationId] } },
      select: { id: true },
    });
    const existing = new Set(terminals.map((t) => t.id));

    if (!existing.has(originId)) {
      throw new BadRequestException(`El terminal de origen con id ${originId} no existe`);
    }
    if (!existing.has(destinationId)) {
      throw new BadRequestException(`El terminal de destino con id ${destinationId} no existe`);
    }

    try {
      return await this.prisma.route.create({
        data: dto,
        include: { origin: terminalWithCity, destination: terminalWithCity },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Ya existe una ruta con ese origen y destino');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('El terminal de origen o destino no existe');
        }
      }

      this.logger.error('Error inesperado al crear ruta', error as Error);
      throw new InternalServerErrorException('No se pudo crear la ruta');
    }
  }
}
