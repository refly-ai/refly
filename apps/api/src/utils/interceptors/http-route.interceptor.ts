import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import { Request } from 'express';

/**
 * NestJS Interceptor that sets http.route on OpenTelemetry RPC metadata for metrics.
 *
 * Problem:
 * - NestJS instrumentation sets http.route on spans but NOT on RPC metadata
 * - HTTP instrumentation reads route from RPC metadata (not spans) for metrics
 * - Result: http.route is missing from metrics like http.server.duration
 *
 * Solution:
 * This interceptor runs after route matching but before response ends.
 * It reads the matched route from Express req.route and sets it on RPC metadata.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/issues/4474
 */
@Injectable()
export class HttpRouteInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Set route immediately when interceptor runs (after route matching)
    this.setHttpRoute(request);

    return next.handle().pipe(
      tap({
        // Also try to set on completion in case route wasn't available earlier
        complete: () => this.setHttpRoute(request),
        error: () => this.setHttpRoute(request),
      }),
    );
  }

  private setHttpRoute(request: Request): void {
    const rpcMetadata = getRPCMetadata(context.active());

    if (rpcMetadata?.type === RPCType.HTTP && !rpcMetadata.route) {
      const route = this.getRoutePattern(request);
      if (route) {
        rpcMetadata.route = route;
      }
    }
  }

  /**
   * Extract route pattern from Express request.
   * Express/NestJS populates req.route.path after matching.
   */
  private getRoutePattern(request: Request): string | undefined {
    const routePath = request.route?.path;

    if (routePath) {
      // Combine baseUrl (controller prefix) with route path (method route)
      const baseUrl = request.baseUrl || '';
      return baseUrl + (routePath === '/' && baseUrl ? '' : routePath);
    }

    return undefined;
  }
}
