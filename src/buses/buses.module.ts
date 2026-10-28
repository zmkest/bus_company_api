import { Module } from '@nestjs/common';
import { BusesService } from './buses.service.js';
import { BusesController } from './buses.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatusHistoryModule } from './status-history/status-history.module.js';
import { UserService } from '../identity/user/user.service.js';
import { MaintenancesModule } from './maintenances/maintenances.module.js';

@Module({
  controllers: [BusesController],
  providers: [BusesService, PrismaService, UserService],
  imports: [StatusHistoryModule, MaintenancesModule],
})
export class BusesModule {}
