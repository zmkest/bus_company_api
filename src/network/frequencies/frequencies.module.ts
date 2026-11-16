import { Module } from '@nestjs/common';
import { FrequenciesService } from './frequencies.service.js';
import { FrequenciesController } from './frequencies.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../../identity/user/user.service.js';

@Module({
  controllers: [FrequenciesController],
  providers: [FrequenciesService, PrismaService, UserService],
})
export class FrequenciesModule {}
