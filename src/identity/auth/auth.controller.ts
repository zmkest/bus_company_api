import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  signUp(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.signUp(createAuthDto);
  }

  @Post('login')
  signIn(@Body() credentials: CredentialsDto) {
    return this.authService.signIn(credentials);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUserId() userId: number) {
    return this.authService.logout(userId);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  createByAdmin(createUserDto: CreateUserByAdminDto) {
    return this.authService.createUserByAdmin(createUserDto);
  }

  @Post('change-password')
  changePasswordLink(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string
  ) {
    return this.authService.changePasswordLink(token, newPassword);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
