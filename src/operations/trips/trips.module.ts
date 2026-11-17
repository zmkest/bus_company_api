import { Module } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { TripsController } from './trips.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';
import { BusAssignmentService } from './bus-assignment/bus-assignment.service.js';

@Module({
  controllers: [TripsController],
  providers: [TripsService, PrismaService, UserService, BusAssignmentService],
  exports: [BusAssignmentService],
})
export class TripsModule {}
