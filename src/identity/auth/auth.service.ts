import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { UserService } from '../user/user.service.js';
import * as bcrypt from 'bcrypt';
import { CredentialsDto } from './dto/credential.dto.js';
import { JwtService } from '@nestjs/jwt';
import { envs } from '../../config/envs.js';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { UserRole } from '../../generated/prisma/enums.js';
import { CreateUserByAdminDto } from './dto/create-user.dto.js';
import { URL } from 'url';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

export interface JwtPayload {
  sub: number;
  purpose: string;
}

@Injectable()
export class AuthService {

  constructor(
    private readonly user: UserService,
    private jwtService: JwtService
  ) { }

  async signUp(createAuthDto: CreateAuthDto) {
    const { password, ...data } = createAuthDto;

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
    if (!user.isActive) throw new UnauthorizedException('La cuenta no está activada');

    const { passwordHash, ...data } = user;
    const comparePasswd = bcrypt.compareSync(password, passwordHash);
    if (!comparePasswd) throw new UnauthorizedException('Credenciales invalidas');
    const tokens = await this.generateTokens(data);
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: data,
    }
  }

  private async generateTokens(user: { id: number; role: UserRole }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: randomUUID(), role: user.role },
      { secret: envs.jwt_refresh_token, expiresIn: '7d' },
    );

    await this.user.updateRefreshToken(user.id, sha256(refreshToken));

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
    const { accessToken, refreshToken: refresh_token } = await this.generateTokens({ id: user.id, role: user.role });
    return {
      access_token: accessToken,
      refresh_token
    }
  }

  async logout(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token,
        { secret: envs.jwt_refresh_token, ignoreExpiration: true }
      );
      console.log(payload)
      await this.user.updateRefreshToken(payload.sub, null);
    } catch {
      console.error('error al obtener el user id del token refresh');
    }
  }

  async createUserByAdmin(createUser: CreateUserByAdminDto) {
    // Contrasenia temporal
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), 10);

    const data = { passwordHash, ...createUser };
    const user = await this.user.createByAdmin(data);

    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        purpose: envs.jwt_pwd_setup_purpose,
      },
      {
        secret: envs.jwt_pwd_setup_secret,
        expiresIn: '15m',
        issuer: envs.jwt_pwd_setup_issuer,
        audience: envs.jwt_pwd_setup_audience,
      }
    );
    const url = new URL(
      '/change-password',
      envs.frontend_url
    );
    url.searchParams.set('token', token);

    console.log(url);
    return user;
  }

  async changePasswordLink(token: string, newPassword: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: envs.jwt_pwd_setup_secret,
        issuer: envs.jwt_pwd_setup_issuer,
        audience: envs.jwt_pwd_setup_audience,
      });

    } catch (error) {
      throw new BadRequestException('El enlace es inválido o ha expirado')
    }

    if (payload.purpose !== envs.jwt_pwd_setup_purpose) throw new BadRequestException('El token no permite establecer una contraseña');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const exist = await this.user.findOne(payload.sub);

    if (!exist) throw new NotFoundException('El usuario no existe');

    return await this.user.changePassword(payload.sub, passwordHash);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const exist = await this.user.findByEmail(email);
    if (!exist) {
      return 'Si la cuenta existe, recibirás un correo con instrucciones';
    }

    const token = await this.jwtService.signAsync(
      {
        sub: exist.id,
        purpose: envs.jwt_pwd_reset_purpose,
      },
      {
        secret: envs.jwt_pwd_reset_secret,
        expiresIn: '15m',
        issuer: envs.jwt_pwd_reset_issuer,
        audience: envs.jwt_pwd_reset_audience,
      }
    );
    const url = new URL(
      '/change-password',
      envs.frontend_url
    );
    url.searchParams.set('token', token);

    console.log(url);

    // todo: Enviar correo electronico con link para cambio de contraseña

    return 'Si la cuenta existe, recibirás un correo con instrucciones';
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword, repitNewPassword } = resetPasswordDto;
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: envs.jwt_pwd_reset_secret,
        issuer: envs.jwt_pwd_reset_issuer,
        audience: envs.jwt_pwd_reset_audience,
      });
    } catch (error) {
      throw new BadRequestException('El token es inválido o ya caducó')
    }

    if (payload.purpose !== envs.jwt_pwd_reset_purpose) throw new BadRequestException('El token no pemrite actualizar la contraseña');

    if (newPassword !== repitNewPassword) throw new BadRequestException('Las contraseñas no coinciden');

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const exist = await this.user.findOne(payload.sub);

    if (!exist) throw new NotFoundException('El usuario no existe');

    return this.user.changePassword(payload.sub, newPasswordHash);
  }
}
