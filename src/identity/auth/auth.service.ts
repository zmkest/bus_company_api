import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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
import { ChangePwdDto } from './dto/change-pwd.dto.js';
import { MailService } from '../../shared/services/mail.service.js';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const SALT_PWD = 10;

export interface JwtPayload {
  sub: number;
  purpose: string;
  fp: string | undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly user: UserService,
    private jwtService: JwtService,
    private mail: MailService,
  ) {}

  async signUp(createAuthDto: CreateAuthDto) {
    const { password, ...data } = createAuthDto;

    const hash = await bcrypt.hash(password, SALT_PWD);

    const user = await this.user.create({
      ...data,
      passwordHash: hash,
    });

    return user;
  }

  async signIn(credentials: CredentialsDto) {
    const { email, password } = credentials;

    const user = await this.user.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales invalidas');
    if (!user.isActive) throw new UnauthorizedException('La cuenta no está activada');

    const { passwordHash, ...data } = user;
    const comparePasswd = await bcrypt.compare(password, passwordHash);
    if (!comparePasswd) throw new UnauthorizedException('Credenciales invalidas');
    const tokens = await this.generateTokens(data);
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: data,
    };
  }

  private async generateTokens(user: { id: number; role: UserRole }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
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
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: envs.jwt_refresh_token });
    } catch {
      throw new UnauthorizedException('Refresh token inválida');
    }

    const user = await this.user.findOne(payload.sub);

    if (!user?.refreshTokenHash || user.refreshTokenHash !== sha256(refreshToken)) {
      throw new UnauthorizedException('Refresh token inválida');
    }
    const { accessToken, refreshToken: refresh_token } = await this.generateTokens({
      id: user.id,
      role: user.role,
    });
    return {
      access_token: accessToken,
      refresh_token,
    };
  }

  async logout(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token, {
        secret: envs.jwt_refresh_token,
        ignoreExpiration: true,
      });
      await this.user.updateRefreshToken(payload.sub, null);
    } catch {
      console.error('error al obtener el user id del token refresh');
    }
  }

  async createUserByAdmin(createUser: CreateUserByAdminDto) {
    // Contrasenia temporal
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), SALT_PWD);

    const data = {
      passwordHash,
      email: createUser.email,
      role: createUser.role,
      name: createUser.name,
    };
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
      },
    );
    const url = new URL('/reset-password', envs.frontend_url);
    url.searchParams.set('token', token);

    const html = this.mail.templateHtmlResetPwd(url.toString());
    await this.mail.send('Restablecer contraseña', [data.email], html);

    return user;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const exist = await this.user.findByEmail(email);
    if (!exist) {
      return { message: 'Si la cuenta existe, recibirás un correo con instrucciones' };
    }

    const token = await this.jwtService.signAsync(
      {
        sub: exist.id,
        purpose: envs.jwt_pwd_reset_purpose,
        fp: sha256(exist.passwordHash),
      },
      {
        secret: envs.jwt_pwd_reset_secret,
        expiresIn: '15m',
        issuer: envs.jwt_pwd_reset_issuer,
        audience: envs.jwt_pwd_reset_audience,
      },
    );
    const url = new URL('/reset-password', envs.frontend_url);
    url.searchParams.set('token', token);

    const html = this.mail.templateHtmlResetPwd(url.toString());
    await this.mail.send('Restablecer contraseña', [email], html);

    return { message: 'Si la cuenta existe, recibirás un correo con instrucciones' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPwd, repitNewPwd } = resetPasswordDto;

    if (newPwd !== repitNewPwd) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const invalidToken = () => new BadRequestException('El enlace es inválido o ya caducó');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: envs.jwt_pwd_reset_secret,
        issuer: envs.jwt_pwd_reset_issuer,
        audience: envs.jwt_pwd_reset_audience,
        algorithms: ['HS256'],
      });
    } catch {
      throw invalidToken();
    }

    if (
      !payload.sub ||
      payload.purpose !== envs.jwt_pwd_reset_purpose ||
      typeof payload.fp !== 'string'
    ) {
      throw invalidToken();
    }

    const user = await this.user.findOneWithPassword(payload.sub);

    if (!user || !user.isActive || payload.fp !== sha256(user.passwordHash)) {
      throw invalidToken();
    }

    const pwdHash = await bcrypt.hash(newPwd, SALT_PWD);

    await this.user.updatePasswordAndRefreshToken(payload.sub, pwdHash, null);

    return { message: 'Contraseña actualizada correctamente' };
  }

  async changePwd(userId: number, dto: ChangePwdDto) {
    const { pwd, newPwd, repitNewPwd } = dto;

    if (newPwd !== repitNewPwd) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }
    if (pwd === newPwd) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const user = await this.user.findOne(userId);

    const isValid = await bcrypt.compare(pwd, user.passwordHash);

    if (!isValid) throw new BadRequestException('Contraseña incorrecta');

    const pwdHash = await bcrypt.hash(newPwd, SALT_PWD);
    const tokens = await this.generateTokens({ id: userId, role: user.role });

    await this.user.updatePasswordAndRefreshToken(userId, pwdHash, tokens.refreshToken);

    return { message: 'Contraseña actualizada correctamente', ...tokens };
  }
}
