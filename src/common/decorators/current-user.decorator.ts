import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) throw new UnauthorizedException();
    if (typeof userId !== 'number') throw new UnauthorizedException();

    return userId;
  },
);