import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { FindRoutesQueryDto } from './dto/find-routes-query.dto.js';
import { paginate } from '../../common/interfaces/paginated.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';

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

  async findAll(query: FindRoutesQueryDto) {
    const { limit, page, order, sortBy, originCityId, destinationCityId } = query;

    const where: Prisma.RouteWhereInput = {
      ...(originCityId && { origin: { cityId: originCityId } }),
      ...(destinationCityId && { destination: { cityId: destinationCityId } }),
    };

    const orderBy: Prisma.RouteOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: order }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        where,
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
        include: { origin: terminalWithCity, destination: terminalWithCity },
      }),
      this.prisma.route.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: number) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        origin: terminalWithCity,
        destination: terminalWithCity,
        frequencies: { orderBy: { departureTime: 'asc' } },
      },
    });

    if (!route) throw new NotFoundException(`Ruta con id #${id} no existe`);
    return route;
  }

  async update(id: number, dto: UpdateRouteDto) {
    if (dto.distanceKm === undefined && dto.durationMinutes === undefined) {
      throw new BadRequestException('Debe enviar distanceKm o durationMinutes para actualizar');
    }

    await this.findOne(id);

    return this.prisma.route.update({
      where: { id },
      data: dto,
      include: { origin: terminalWithCity, destination: terminalWithCity },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    const [frequencies, trips] = await this.prisma.$transaction([
      this.prisma.frequency.count({ where: { routeId: id } }),
      this.prisma.trip.count({ where: { routeId: id } }),
    ]);

    if (frequencies > 0 || trips > 0) {
      throw new ConflictException(
        `No se puede eliminar: la ruta tiene ${frequencies} frecuencia(s) y ${trips} viaje(s) asociados`,
      );
    }

    try {
      return await this.prisma.route.delete({ where: { id } });
    } catch (error) {
      // A frequency or trip may have been linked between the check and the delete (FK Restrict)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'No se puede eliminar: la ruta tiene frecuencias o viajes asociados',
        );
      }
      throw error;
    }
  }
}
