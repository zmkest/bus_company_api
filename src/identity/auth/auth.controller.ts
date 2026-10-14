import { Controller, Post, Body, UseGuards, Res, Req, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { CredentialsDto } from './dto/credential.dto.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { Roles } from '../../common/decorators/roles-user.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { RoleGuard } from '../../common/guards/role.guard.js';
import { CreateUserByAdminDto } from './dto/create-user.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { CookieOptions, Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private get cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions, maxAge: REFRESH_MAX_AGE });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }

  @Post('register')
  signUp(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.signUp(createAuthDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Body() credentials: CredentialsDto, 
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, access_token, refresh_token } = await this.authService.signIn(credentials);
    this.setRefreshCookie(res, refresh_token);
    return { user, access_token };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Sesión no encontrada');

    try {
      const { access_token, refresh_token } = await this.authService.refreshToken(token);
      this.setRefreshCookie(res, refresh_token);
      return { access_token };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.authService.logout(token);
    this.clearRefreshCookie(res);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post('users')
  createByAdmin(@Body() createUserDto: CreateUserByAdminDto) {
    return this.authService.createUserByAdmin(createUserDto);
  }

  @Post('change-password')
  changePasswordLink(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string
  ) {
    return this.authService.changePasswordLink(token, newPassword);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
