import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../../common/redis.service';
import { OPENAPI_DEBOUNCE_TTL, REDIS_KEY_OPENAPI_DEBOUNCE } from '../openapi.constants';
import { OpenAPIRequest } from '../types/request.types';
import * as crypto from 'node:crypto';

/**
 * Guard for webhook request deduplication
 * Prevents duplicate requests within a short time window
 */
@Injectable()
export class DebounceGuard implements CanActivate {
  private readonly logger = new Logger(DebounceGuard.name);

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OpenAPIRequest>();

    // Get user ID and canvas ID
    const uid = request.user?.uid || request.uid;
    const canvasId = request.params?.canvasId;

    if (!uid || !canvasId) {
      // If no uid or canvasId, skip debouncing
      return true;
    }

    try {
      // Generate fingerprint from uid, canvasId, and request body
      const fingerprint = this.generateFingerprint(uid, canvasId, request.body);
      const debounceKey = `${REDIS_KEY_OPENAPI_DEBOUNCE}:${fingerprint}`;

      // Check if this request was recently made
      const exists = await this.redisService.get(debounceKey);

      if (exists) {
        this.logger.warn(
          `Duplicate request detected for uid=${uid}, canvasId=${canvasId}. Fingerprint: ${fingerprint}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            message: 'Duplicate request detected. Please wait before retrying.',
            error: 'Conflict',
          },
          HttpStatus.CONFLICT,
        );
      }

      // Set debounce key with TTL
      await this.redisService.setex(debounceKey, OPENAPI_DEBOUNCE_TTL, '1');

      this.logger.log(
        `Debounce check passed for uid=${uid}, canvasId=${canvasId}. Fingerprint: ${fingerprint}`,
      );

      return true;
    } catch (error) {
      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // In case of Redis error, allow the operation to avoid blocking legitimate users
      this.logger.error(`Debounce check failed for uid=${uid}: ${error.message}`);
      return true;
    }
  }

  /**
   * Generate MD5 fingerprint from uid, canvasId, and request body
   */
  private generateFingerprint(uid: string, canvasId: string, body: any): string {
    const data = `${uid}:${canvasId}:${JSON.stringify(body || {})}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }
}
