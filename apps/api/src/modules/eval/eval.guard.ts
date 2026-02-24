import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class EvalServiceKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing eval service key (use Authorization: Bearer <key>)');
    }

    const serviceKey = this.configService.get<string>('eval.serviceKey');
    if (!serviceKey || token !== serviceKey) {
      throw new UnauthorizedException('Invalid eval service key');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [scheme, token] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }
    return undefined;
  }
}
