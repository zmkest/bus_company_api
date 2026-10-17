import { Module } from '@nestjs/common';
import { BusesService } from './buses.service.js';
import { BusesController } from './buses.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatusHistoryModule } from './status-history/status-history.module.js';

@Module({
  controllers: [BusesController],
  providers: [BusesService, PrismaService],
  imports: [StatusHistoryModule],
})
export class BusesModule {}
