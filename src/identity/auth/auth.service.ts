import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../user/user.service.js';
import * as bcrypt from 'bcrypt';
import { CredentialsDto } from './dto/credential.dto.js';
import { JwtService } from '@nestjs/jwt';
import { envs } from '../../config/envs.js';
import { createHash, randomUUID } from 'crypto';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly user: UserService,
    private jwtService: JwtService
  ) { }

  async signUp(createAuthDto: CreateAuthDto) {
    const { passwordHash: password, ...data } = createAuthDto;

    const hash = await bcrypt.hash(password, 10);

    const user = await this.user.create({
      ...data,
      passwordHash: hash
    });

    return user;
  }

  async signIn(credentials: CredentialsDto) {
    const { email, password } = credentials;

    const user = await this.user.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales invalidas');

    const { passwordHash, ...data } = user;
    const comparePasswd = bcrypt.compareSync(password, passwordHash);
    if (!comparePasswd) throw new UnauthorizedException('Credenciales invalidas');
    const tokens = await this.generateTokens(user.id);
    // generar un token jwt
    const payload = data;
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user,
    }
  }

  private async generateTokens(userId: number) {
    const accessToken = await this.jwtService.signAsync({ sub: userId });

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: randomUUID() },
      { secret: envs.jwt_refresh_token, expiresIn: '7d' },
    );

    await this.user.updateRefreshToken(userId, sha256(refreshToken));

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: number };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: envs.jwt_refresh_token })
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválida');
    }

    const user = await this.user.findOne(payload.sub);

    if (!user?.refreshTokenHash || user.refreshTokenHash !== sha256(refreshToken)) {
      throw new UnauthorizedException('Refresh token inválida');
    }
    return this.generateTokens(user.id);
  }


  async logout(userId: number) {
    await this.user.updateRefreshToken(userId, null);
  }

}
