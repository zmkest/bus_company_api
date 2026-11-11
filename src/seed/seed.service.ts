import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CITIES } from './data/cities.data.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      this.logger.log('Seed omitido: NODE_ENV no es "development".');
      return;
    }

    try {
      await this.seedCities();
    } catch (error) {
      this.logger.error(
        'Error ejecutando el seed de ciudades',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async seedCities(): Promise<void> {
    const count = await this.prisma.city.count();

    if (count >= CITIES.length) {
      this.logger.log(`Ciudades ya cargadas (${count}). Seed omitido.`);
      return;
    }

    const namesCities = CITIES.map((c) => ({ name: c.name }));
    const inserted = await this.prisma.$transaction(async (tx) => {
      const affected = await tx.city.createMany({ data: namesCities });

      return affected;
    });

    this.logger.log(
      `Seed de ciudades completado: ${inserted.count} insertadas (antes había ${count}).`,
    );
  }
}
