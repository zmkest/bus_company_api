import { Module } from '@nestjs/common';
import { SeatsService } from './seats.service.js';
import { SeatsController } from './seats.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [SeatsController],
  providers: [SeatsService, PrismaService, UserService],
})
export class SeatsModule {}
