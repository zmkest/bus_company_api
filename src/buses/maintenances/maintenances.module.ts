import { Module } from '@nestjs/common';
import { MaintenancesService } from './maintenances.service.js';
import { MaintenancesController } from './maintenances.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [MaintenancesController],
  providers: [MaintenancesService, PrismaService, UserService],
})
export class MaintenancesModule {}
