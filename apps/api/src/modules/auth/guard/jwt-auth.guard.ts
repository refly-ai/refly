import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '@refly/utils';
import { isDesktop } from '../../../utils/runtime';
import { ApiKeyService } from '../api-key.service';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ApiKeyService))
    private apiKeyService: ApiKeyService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    // If we are in desktop mode, we don't need to check the JWT token
    if (isDesktop()) {
      request.user = { uid: this.configService.get('local.uid') };
      return true;
    }

    // Try API Key authentication first (for CLI)
    const apiKey = this.extractApiKeyFromRequest(request);
    if (apiKey) {
      const uid = await this.apiKeyService.validateApiKey(apiKey);
      if (uid) {
        // Fetch user info from database
        const user = await this.prismaService.user.findUnique({
          where: { uid },
        });
        if (user) {
          request.user = { uid: user.uid, email: user.email, name: user.name };
          return true;
        }
      }
      throw new UnauthorizedException('Invalid API key');
    }

    // Fall back to JWT authentication
    const token = this.extractTokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException();
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
      throw new UnauthorizedException();
    }
    return true;
  }

  /**
   * Extract API key from request
   * Supports: Authorization: Bearer rf_xxx or X-API-Key: rf_xxx
   */
  private extractApiKeyFromRequest(request: Request): string | undefined {
    // Check X-API-Key header first
    const apiKeyHeader = request.headers?.['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('rf_')) {
      return apiKeyHeader;
    }

    // Check Authorization header for API key (Bearer rf_xxx)
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token?.startsWith('rf_')) {
        return token;
      }
    }

    return undefined;
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // Try to get token from Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && !token?.startsWith('rf_')) {
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
