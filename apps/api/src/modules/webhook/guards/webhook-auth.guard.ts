import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../../auth/api-key.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * Guard for webhook API Key authentication
 * Prefer Authorization: Bearer <API_KEY>; keep X-Refly-Api-Key for compatibility.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    // Extract API key from supported headers
    const apiKey = this.extractApiKeyFromRequest(request);
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key (use Authorization: Bearer <API_KEY>)');
    }

    // Validate API key
    const uid = await this.apiKeyService.validateApiKey(apiKey);
    if (!uid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Fetch user info from database
    const user = await this.prismaService.user.findUnique({
      where: { uid },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach user to request
    request.user = { uid: user.uid, email: user.email, name: user.name };

    return true;
  }

  /**
   * Extract API key from request
   * Supports: Authorization: Bearer <API_KEY> or X-Refly-Api-Key
   */
  private extractApiKeyFromRequest(request: Request): string | undefined {
    const apiKeyHeader = request.headers?.['x-refly-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('rf_')) {
      return apiKeyHeader;
    }
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [scheme, token] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token?.startsWith('rf_')) {
        return token;
      }
    }
    return undefined;
  }
}
