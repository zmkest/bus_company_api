import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFrequencyDto } from './dto/create-frequency.dto.js';

import { Weekday } from '../../generated/prisma/enums.js';

const WEEKDAY_ORDER = Object.values(Weekday);

@Injectable()
export class FrequenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFrequencyDto) {
    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
      select: { id: true },
    });
    if (!route) {
      throw new BadRequestException(`La ruta con id ${dto.routeId} no existe`);
    }

    return this.prisma.frequency.create({
      data: {
        routeId: dto.routeId,
        departureTime: new Date(`1970-01-01T${dto.departureTime}:00Z`),
        weekdays: [...dto.weekdays].sort(
          (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
        ),
        basePrice: dto.basePrice,
      },
    });
  }
}
