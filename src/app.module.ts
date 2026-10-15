import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './identity/auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UserModule } from './identity/user/user.module.js';
import { BusesModule } from './buses/buses.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 }
    ]),
    ConfigModule.forRoot({ isGlobal: true }), 
    AuthModule, 
    PrismaModule, 
    UserModule, 
    BusesModule
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
