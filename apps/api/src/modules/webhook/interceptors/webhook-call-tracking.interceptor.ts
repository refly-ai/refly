import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { createId } from '@paralleldrive/cuid2';
import { WebhookService } from '../webhook.service';
import { ApiCallStatus } from '../webhook.constants';

type WebhookRequest = Request & {
  uid?: string;
  user?: {
    uid?: string;
  };
};

@Injectable()
export class WebhookCallTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(WebhookCallTrackingInterceptor.name);

  constructor(private readonly webhookService: WebhookService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();
    const recordId = `rec_${createId()}`;
    const requestUrl = request.originalUrl || request.url;
    const requestMethod = request.method;
    const requestHeaders = request.headers;
    const requestBody = requestMethod === 'GET' ? request.query : request.body;
    const webhookId = this.extractWebhookId(request);

    let uid = request.user?.uid ?? request.uid ?? 'unknown';
    let canvasId: string | undefined;
    let apiId: string | undefined = webhookId;

    if (webhookId) {
      try {
        const config = await this.webhookService.getWebhookConfigById(webhookId);
        if (config) {
          uid = config.uid;
          canvasId = config.canvasId;
          apiId = config.apiId;
        }
      } catch (error) {
        this.logger.warn(`Failed to load webhook config: ${error?.message}`);
      }
    }

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const httpStatus = response?.statusCode ?? 200;

        this.recordApiCall({
          recordId,
          uid,
          apiId: apiId ?? null,
          canvasId,
          requestUrl,
          requestMethod,
          requestBody,
          requestHeaders,
          httpStatus,
          responseTime,
          status: ApiCallStatus.SUCCESS,
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const httpStatus = this.extractHttpStatus(error) ?? response?.statusCode ?? 500;
        const errorMessage = this.extractErrorMessage(error);

        this.recordApiCall({
          recordId,
          uid,
          apiId: apiId ?? null,
          canvasId,
          requestUrl,
          requestMethod,
          requestBody,
          requestHeaders,
          httpStatus,
          responseTime,
          status: ApiCallStatus.FAILED,
          failureReason: errorMessage,
        });

        return throwError(() => error);
      }),
    );
  }

  private recordApiCall(data: Parameters<WebhookService['recordApiCall']>[0]): void {
    this.webhookService.recordApiCall(data).catch((error) => {
      this.logger.error(`Failed to record API call: ${error?.message}`);
    });
  }

  private extractWebhookId(request: WebhookRequest): string | undefined {
    const params = request.params as Record<string, unknown> | undefined;
    const webhookId = params?.webhookId;
    return typeof webhookId === 'string' ? webhookId : undefined;
  }

  private extractHttpStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }
    const maybeError = error as {
      status?: number;
      statusCode?: number;
      getStatus?: () => number;
    };
    if (typeof maybeError.getStatus === 'function') {
      const status = maybeError.getStatus();
      return Number.isFinite(status) ? status : undefined;
    }
    if (typeof maybeError.status === 'number') {
      return maybeError.status;
    }
    if (typeof maybeError.statusCode === 'number') {
      return maybeError.statusCode;
    }
    return undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: string }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return String(error);
  }
}
