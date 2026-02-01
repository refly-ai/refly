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

  /**
   * Guard method to check if the request should be allowed
   * @param context - Execution context
   * @returns Promise<boolean> - true if request is allowed, throws HttpException if duplicate detected
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();

    // Get user ID and webhook ID
    const uid = request.user?.uid ?? request.uid;
    const webhookId = request.params?.webhookId;

    if (!uid || !webhookId) {
      // If no uid or webhookId, skip debouncing
      return true;
    }

    try {
      // Generate fingerprint from uid, webhookId, and request body
      const fingerprint = this.generateFingerprint(uid, webhookId, request.body);
      const debounceKey = `${REDIS_KEY_WEBHOOK_DEBOUNCE}:${fingerprint}`;

      // Atomically try to set the debounce key
      // Returns true if key was set (first request), false if key already exists (duplicate)
      const wasSet = await this.redisService.setIfNotExists(debounceKey, '1', WEBHOOK_DEBOUNCE_TTL);

      if (!wasSet) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Debounce check failed for uid=${uid}: ${errorMessage}`);
      return true;
    }
  }

  /**
   * Generate MD5 fingerprint from uid, webhookId, and request body
   * @param uid - User ID
   * @param webhookId - Webhook ID
   * @param body - Request body
   * @returns string - MD5 hash fingerprint
   */
  private generateFingerprint(uid: string, webhookId: string, body: unknown): string {
    const data = `${uid}:${webhookId}:${JSON.stringify(body ?? {})}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }
}
