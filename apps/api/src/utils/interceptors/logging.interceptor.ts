import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = req;
    const user = req.user ? `User ID: ${req.user.id}` : 'Unauthenticated user';

    // Request start time
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Calculate request processing time
        const responseTime = Date.now() - now;

        // Log request information
        this.logger.log(
          `${method} ${url} - ${responseTime}ms - ${user} - Params: ${JSON.stringify({
            body: this.sanitizeData(body),
            params,
            query,
          })}`,
        );
      }),
    );
  }

  // Sanitize sensitive data to avoid logging passwords
  private sanitizeData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };

    // If password field is present, replace with [REDACTED]
    if (sanitized.password) {
      sanitized.password = '[REDACTED]';
    }

    return sanitized;
  }
}
