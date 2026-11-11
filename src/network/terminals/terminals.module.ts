import { Module } from '@nestjs/common';
import { TerminalsService } from './terminals.service.js';
import { TerminalsController } from './terminals.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [TerminalsController],
  providers: [TerminalsService, PrismaService, UserService],
})
export class TerminalsModule {}
