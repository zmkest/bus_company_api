import { Module } from '@nestjs/common';
import { BusesService } from './buses.service.js';
import { BusesController } from './buses.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [BusesController],
  providers: [BusesService, PrismaService],
})
export class BusesModule {}
