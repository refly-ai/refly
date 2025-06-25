import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '@refly/utils';
import { isDesktop } from '../../../utils/runtime';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    // If we are in desktop mode, we don't need to check the JWT token
    if (isDesktop()) {
      request.user = { uid: this.configService.get('local.uid') };
      return true;
    }

    const token = this.extractTokenFromRequest(request);
    if (!token) {
      // No token found, but we allow the request to proceed
      // The user will be null in the controller
      request.user = null;
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('auth.jwt.secret'),
      });

      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request.user = payload;
    } catch (error) {
      this.logger.warn(`jwt verify not valid: ${error}`);
      // Token is invalid, but we still allow the request to proceed
      // The user will be null in the controller
      request.user = null;
    }
    return true;
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // Try to get token from Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }

    // Try to get token from cookie
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (token) {
      return token;
    }

    return undefined;
  }
}
