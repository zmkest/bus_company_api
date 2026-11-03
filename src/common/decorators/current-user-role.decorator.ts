import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums.js';

export const CurrentUserRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserRole => {
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;

    if (!role) throw new UnauthorizedException();

    if (!Object.values(UserRole).includes(role)) {
      throw new UnauthorizedException();
    }

    return role;
  },
);
