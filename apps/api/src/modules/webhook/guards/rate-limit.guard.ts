import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { RedisService } from '../../common/redis.service';
import {
  WEBHOOK_RATE_LIMIT_RPM,
  WEBHOOK_RATE_LIMIT_DAILY,
  WEBHOOK_RATE_LIMIT_RPM_TTL,
  WEBHOOK_RATE_LIMIT_DAILY_TTL,
  REDIS_KEY_WEBHOOK_RATE_LIMIT_RPM,
  REDIS_KEY_WEBHOOK_RATE_LIMIT_DAILY,
} from '../webhook.constants';
import { WebhookRequest } from '../types/request.types';

/**
 * Guard for webhook rate limiting
 * Implements both RPM (requests per minute) and daily limits
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const response: Response = context.switchToHttp().getResponse();

    // Get user ID from request (set by auth guard or webhook validation)
    const uid = request.user?.uid || request.uid;

    if (!uid) {
      // If no uid, skip rate limiting (should not happen in normal flow)
      return true;
    }

    try {
      // Check RPM limit
      const rpmKey = `${REDIS_KEY_WEBHOOK_RATE_LIMIT_RPM}:${uid}`;
      const rpmCount = await this.redisService.incrementWithExpire(
        rpmKey,
        WEBHOOK_RATE_LIMIT_RPM_TTL,
      );

      // Check daily limit
      const dailyKey = `${REDIS_KEY_WEBHOOK_RATE_LIMIT_DAILY}:${uid}`;
      const dailyCount = await this.redisService.incrementWithExpire(
        dailyKey,
        WEBHOOK_RATE_LIMIT_DAILY_TTL,
      );

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit-RPM', WEBHOOK_RATE_LIMIT_RPM.toString());
      response.setHeader(
        'X-RateLimit-Remaining-RPM',
        Math.max(0, WEBHOOK_RATE_LIMIT_RPM - rpmCount).toString(),
      );
      response.setHeader('X-RateLimit-Limit-Daily', WEBHOOK_RATE_LIMIT_DAILY.toString());
      response.setHeader(
        'X-RateLimit-Remaining-Daily',
        Math.max(0, WEBHOOK_RATE_LIMIT_DAILY - dailyCount).toString(),
      );

      // Check if RPM limit exceeded
      if (rpmCount > WEBHOOK_RATE_LIMIT_RPM) {
        this.logger.warn(
          `RPM rate limit exceeded for uid=${uid}. Count: ${rpmCount}/${WEBHOOK_RATE_LIMIT_RPM}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded: ${WEBHOOK_RATE_LIMIT_RPM} requests per minute`,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Check if daily limit exceeded
      if (dailyCount > WEBHOOK_RATE_LIMIT_DAILY) {
        this.logger.warn(
          `Daily rate limit exceeded for uid=${uid}. Count: ${dailyCount}/${WEBHOOK_RATE_LIMIT_DAILY}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Daily rate limit exceeded: ${WEBHOOK_RATE_LIMIT_DAILY} requests per day`,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.logger.log(
        `Rate limit check passed for uid=${uid}. RPM: ${rpmCount}/${WEBHOOK_RATE_LIMIT_RPM}, Daily: ${dailyCount}/${WEBHOOK_RATE_LIMIT_DAILY}`,
      );

      return true;
    } catch (error) {
      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // In case of Redis error, allow the operation to avoid blocking legitimate users
      this.logger.error(`Rate limit check failed for uid=${uid}: ${error.message}`);
      return true;
    }
  }
}
