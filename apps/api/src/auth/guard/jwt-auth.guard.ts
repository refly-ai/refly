import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedError } from '@refly-packages/errors';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // If there's an error or no user, throw custom error
    if (err || !user) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    return user;
  }
}
