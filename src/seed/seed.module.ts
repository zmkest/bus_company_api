import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserService } from '../identity/user/user.service.js';
import { SeedService } from './seed.service.js';

@Module({
  providers: [SeedService, PrismaService, UserService],
})
export class SeedModule {}
