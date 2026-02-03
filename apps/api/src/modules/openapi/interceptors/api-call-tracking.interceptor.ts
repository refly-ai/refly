import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { createId } from '@paralleldrive/cuid2';
import { OpenapiService, ApiCallStatus } from '../openapi.service';

type OpenapiRequest = Request & {
  user?: {
    uid?: string;
  };
  apiKeyId?: string;
};

@Injectable()
export class ApiCallTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiCallTrackingInterceptor.name);

  constructor(private readonly openapiService: OpenapiService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<OpenapiRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const uid = request.user?.uid;

    if (!uid) {
      return next.handle();
    }

    const startTime = Date.now();
    const recordId = `rec_${createId()}`;
    const apiId = request.apiKeyId;
    const requestUrl = request.originalUrl || request.url;
    const requestMethod = request.method;
    const requestHeaders = request.headers;
    const requestBody = requestMethod === 'GET' ? request.query : request.body;
    const canvasId = this.extractCanvasId(request);
    const requestExecutionId = this.extractExecutionId(request);

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime;
        const responseExecutionId = this.extractExecutionIdFromResponse(data);
        const workflowExecutionId = responseExecutionId ?? requestExecutionId;
        const httpStatus = response?.statusCode ?? 200;

        this.recordApiCall({
          recordId,
          uid,
          apiId: apiId ?? null,
          canvasId,
          workflowExecutionId,
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
          workflowExecutionId: requestExecutionId,
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

  private recordApiCall(data: Parameters<OpenapiService['recordApiCall']>[0]): void {
    this.openapiService.recordApiCall(data).catch((error) => {
      this.logger.error(`Failed to record API call: ${error?.message}`);
    });
  }

  private extractCanvasId(request: OpenapiRequest): string | undefined {
    const params = request.params as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown> | undefined;
    const body = request.body as Record<string, unknown> | undefined;
    const canvasId = params?.canvasId ?? query?.canvasId ?? body?.canvasId;
    return typeof canvasId === 'string' ? canvasId : undefined;
  }

  private extractExecutionId(request: OpenapiRequest): string | undefined {
    const params = request.params as Record<string, unknown> | undefined;
    const executionId = params?.executionId;
    return typeof executionId === 'string' ? executionId : undefined;
  }

  private extractExecutionIdFromResponse(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }
    const data = (response as { data?: Record<string, unknown> }).data;
    const executionId = data?.executionId ?? (response as Record<string, unknown>).executionId;
    return typeof executionId === 'string' ? executionId : undefined;
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
