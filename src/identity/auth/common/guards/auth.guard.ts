
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../../user/user.service.js';
import { JwtPayload } from '../../auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    let payload: JwtPayload;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (!Number.isInteger(payload.sub) || payload.sub <= 0) throw new UnauthorizedException();

    const userId = payload.sub;
    const user = await this.userService.findActiveById(userId);

    if (!user) throw new UnauthorizedException();

    request.user = {
      sub: user.id,
      role: user.role
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
