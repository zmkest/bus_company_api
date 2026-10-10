import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { envs } from '../config/index.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements
    OnModuleInit {

    constructor(configService: ConfigService) {
        const adapter = new PrismaPg({
            connectionString: configService.getOrThrow<string>('DATABASE_URL'),
        });
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

}
