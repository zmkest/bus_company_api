import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service.js';
import { RoutesController } from './routes.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, PrismaService, UserService],
})
export class RoutesModule {}
