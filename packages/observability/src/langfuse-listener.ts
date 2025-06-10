import { createId } from '@paralleldrive/cuid2';
import { Langfuse } from 'langfuse';
import { OpenTelemetryListener } from './types';
import { Span } from '@opentelemetry/api';

export class LangfuseListener implements OpenTelemetryListener {
  private langfuse: Langfuse;
  private spanMap = new Map<string, any>();

  constructor(options: {
    publicKey: string;
    secretKey: string;
    baseUrl?: string;
  }) {
    this.langfuse = new Langfuse(options);
  }

  /**
   * Create a new trace for monitoring
   */
  createTrace(options: { userId: string; metadata: Record<string, any> }) {
    const traceId = this.generateId();
    const trace = this.langfuse.trace({
      id: traceId,
      name: 'Model Operation',
      userId: options.userId,
      metadata: options.metadata,
    });

    return {
      createSpan: (spanOptions: { name: string }) => {
        const spanId = this.generateId();
        const span = trace.span({
          id: spanId,
          name: spanOptions.name,
          startTime: new Date(),
        });

        return {
          log: (message: string, data?: any) => {
            span.event({
              name: message,
              startTime: new Date(),
              metadata: data ? { data } : undefined,
            });
          },
          end: () => {
            span.end();
          },
        };
      },
      log: (message: string, data?: any) => {
        trace.event({
          name: message,
          startTime: new Date(),
          metadata: data ? { data } : undefined,
        });
      },
    };
  }

  onSpanStart(span: Span): void {
    try {
      const spanId = this.generateId();
      const traceId = this.generateId();

      // Store span mapping for later use
      this.spanMap.set(span.spanContext().spanId, {
        langfuseSpanId: spanId,
        langfuseTraceId: traceId,
        startTime: Date.now(),
      });

      // Create Langfuse trace and span
      const trace = this.langfuse.trace({
        id: traceId,
        name: 'OpenTelemetry Trace',
      });

      trace.span({
        id: spanId,
        name: 'OpenTelemetry Span',
        startTime: new Date(),
      });
    } catch (error) {
      console.error('Error in LangfuseListener.onSpanStart:', error);
    }
  }

  onSpanEnd(span: Span): void {
    try {
      const spanContext = span.spanContext();
      const spanData = this.spanMap.get(spanContext.spanId);

      if (!spanData) {
        return;
      }

      // Update the span with end information
      // Note: In a real implementation, you would need to access the span's
      // actual data through a span processor or exporter

      this.spanMap.delete(spanContext.spanId);
    } catch (error) {
      console.error('Error in LangfuseListener.onSpanEnd:', error);
    }
  }

  onSpanError(span: Span, error: Error): void {
    try {
      const spanContext = span.spanContext();
      const spanData = this.spanMap.get(spanContext.spanId);

      if (!spanData) {
        return;
      }

      // Log error information
      console.error('Span error:', error);
    } catch (err) {
      console.error('Error in LangfuseListener.onSpanError:', err);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.langfuse.shutdownAsync();
    } catch (error) {
      console.error('Error flushing Langfuse:', error);
    }
  }

  private generateId(): string {
    return createId();
  }

  // Helper methods for data desensitization
  private desensitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];
      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  private desensitizeQuery(query: string): string {
    // Basic SQL query desensitization
    const sensitivePatterns = [
      /password\s*=\s*'[^']*'/gi,
      /token\s*=\s*'[^']*'/gi,
      /secret\s*=\s*'[^']*'/gi,
    ];

    let desensitized = query;
    for (const pattern of sensitivePatterns) {
      desensitized = desensitized.replace(pattern, (match) => {
        const parts = match.split('=');
        return `${parts[0]}='[REDACTED]'`;
      });
    }

    return desensitized;
  }

  private desensitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Check if it looks like sensitive data
      const sensitiveKeywords = ['password', 'token', 'secret', 'key', 'auth'];
      const lowerValue = value.toLowerCase();

      if (sensitiveKeywords.some((keyword) => lowerValue.includes(keyword))) {
        return '[REDACTED]';
      }
    }

    return value;
  }
}

// Factory function to create LangfuseService
export function createLangfuseService(publicKey: string, secretKey: string, baseUrl?: string) {
  const { LangfuseService } = require('./langfuse.service');
  return new LangfuseService(publicKey, secretKey, baseUrl);
}
