import { Module } from '@nestjs/common';
import { StatusHistoryService } from './status-history.service.js';
import { StatusHistoryController } from './status-history.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [StatusHistoryController],
  providers: [StatusHistoryService, PrismaService, UserService],
})
export class StatusHistoryModule {}
