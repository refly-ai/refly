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
import { User } from '../../generated/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle http exceptions
    if (exception instanceof HttpException) {
      this.logger.warn(
        `Request: ${request.method} ${request.url} http exception: (${exception.getStatus()}) ${
          exception.message
        }, ` + `stack: ${exception.stack}`,
      );

      const status = exception.getStatus();
      response?.status(status).json(exception.getResponse());
      return;
    }

    const user = request.user as User;

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
      this.logger.error(
        `Request: ${request.method} ${request.url} unknown err: ${exception.stack}`,
      );
    } else {
      // Handle other business exceptions
      this.logger.warn(
        `Request: ${request.method} ${request.url} biz err: ${baseRespData.errMsg}, ` +
          `stack: ${baseRespData.stack}`,
      );
    }

    response?.status(HttpStatus.OK).json(baseRespData);
  }
}
