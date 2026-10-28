import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { UserService } from '../user/user.service.js';
import { JwtModule } from '@nestjs/jwt';
import { envs } from '../../config/envs.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: envs.jwt_secret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService],
})
export class AuthModule {}
