import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { CredentialsDto } from './dto/credential.dto.js';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from './common/guards/auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

}
