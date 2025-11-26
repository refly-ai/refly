import {
  ExceptionFilter,
  HttpStatus,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import * as Sentry from '@sentry/node';
import { OAuthError, UnknownError } from '@refly/errors';
import { genBaseRespDataFromError } from '../exception';
import { User } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  // Maximum size for request body logging to prevent performance issues
  private readonly MAX_BODY_LOG_SIZE = 1000;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  /**
   * Safely truncate request body for logging to prevent performance issues
   * with large request bodies
   */
  private getSafeBodyForLogging(body: any): string {
    if (!body) {
      return 'null';
    }

    try {
      const bodyString = JSON.stringify(body);

      // If body is small enough, return it as is
      if (bodyString.length <= this.MAX_BODY_LOG_SIZE) {
        return bodyString;
      }

      // For large bodies, truncate and add indicator
      return `${bodyString.substring(0, this.MAX_BODY_LOG_SIZE)}... [truncated, original size: ${bodyString.length} bytes]`;
    } catch {
      // If JSON.stringify fails (e.g., circular references), return a safe fallback
      return '[body serialization failed]';
    }
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const user = request.user as User;

    // Handle http exceptions
    if (exception instanceof HttpException) {
      // Print warning logs for all exceptions except status 401
      if (exception.getStatus() !== HttpStatus.UNAUTHORIZED) {
        this.logger.warn(
          `Request from user ${user?.uid}: ${request.method} ${request.url} http exception: (${exception.getStatus()}) ${
            exception.message
          }, ` + `stack: ${exception.stack}`,
        );
      }

      const status = exception.getStatus();
      response?.status(status).json(exception.getResponse());
      return;
    }

    const baseRespData = genBaseRespDataFromError(exception);

    // Handle OAuth errors, redirect to home page
    if (baseRespData.errCode === new OAuthError().code) {
      const redirectUrl = this.configService.get('auth.redirectUrl');
      response?.redirect(`${redirectUrl}?loginFailed=1`);
      return;
    }

    if (baseRespData.errCode === new UnknownError().code) {
      Sentry.captureException(exception, {
        user: {
          id: user?.uid,
          email: user?.email,
        },
      });

      const safeBody = this.getSafeBodyForLogging(request.body);
      this.logger.error(
        `Request from user ${user?.uid}: ${request.method} ${request.url} with body ${safeBody} ` +
          `unknown err: ${exception.stack}`,
      );
    } else {
      // Handle other business exceptions
      this.logger.warn(
        `Request from user ${user?.uid}: ${request.method} ${request.url} biz err: ${baseRespData.errMsg}, ` +
          `stack: ${baseRespData.stack}`,
      );
    }

    response?.status(HttpStatus.OK).json(baseRespData);
  }
}
