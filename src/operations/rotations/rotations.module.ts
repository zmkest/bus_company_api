import { Module } from '@nestjs/common';
import { RotationsService } from './rotations.service.js';
import { RotationsController } from './rotations.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';
import { TripsModule } from '../trips/trips.module.js';

@Module({
  imports: [TripsModule],
  controllers: [RotationsController],
  providers: [RotationsService, PrismaService, UserService],
})
export class RotationsModule {}
