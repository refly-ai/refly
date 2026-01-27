import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../../common/redis.service';
import { WEBHOOK_DEBOUNCE_TTL, REDIS_KEY_WEBHOOK_DEBOUNCE } from '../webhook.constants';
import { WebhookRequest } from '../types/request.types';
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
    const request = context.switchToHttp().getRequest<WebhookRequest>();

    // Get user ID and webhook ID
    const uid = request.user?.uid || request.uid;
    const webhookId = request.params?.webhookId;

    if (!uid || !webhookId) {
      // If no uid or webhookId, skip debouncing
      return true;
    }

    try {
      // Generate fingerprint from uid, webhookId, and request body
      const fingerprint = this.generateFingerprint(uid, webhookId, request.body);
      const debounceKey = `${REDIS_KEY_WEBHOOK_DEBOUNCE}:${fingerprint}`;

      // Check if this request was recently made
      const exists = await this.redisService.get(debounceKey);

      if (exists) {
        this.logger.warn(
          `Duplicate request detected for uid=${uid}, webhookId=${webhookId}. Fingerprint: ${fingerprint}`,
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
      await this.redisService.setex(debounceKey, WEBHOOK_DEBOUNCE_TTL, '1');

      this.logger.log(
        `Debounce check passed for uid=${uid}, webhookId=${webhookId}. Fingerprint: ${fingerprint}`,
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
   * Generate MD5 fingerprint from uid, webhookId, and request body
   */
  private generateFingerprint(uid: string, webhookId: string, body: any): string {
    const data = `${uid}:${webhookId}:${JSON.stringify(body || {})}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }
}
