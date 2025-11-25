import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as UserModel } from '@prisma/client';

export const LoginedUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserModel | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
