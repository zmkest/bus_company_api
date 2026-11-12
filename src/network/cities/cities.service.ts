import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FindCitiesQueryDto } from './dto/find-cities-query.dto.js';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: FindCitiesQueryDto) {
    const { search, withTerminals } = query;

    const where: Prisma.CityWhereInput = {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(withTerminals && { terminal: { some: {} } }),
    };

    return this.prisma.city.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
