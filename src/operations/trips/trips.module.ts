import { Module } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { TripsController } from './trips.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [TripsController],
  providers: [TripsService, PrismaService, UserService],
})
export class TripsModule {}
