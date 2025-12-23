import { trace, Span, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('refly-api', '1.0.0');

/**
 * Method decorator that creates OpenTelemetry spans for tracing.
 * Handles both sync and async methods via runtime Promise detection.
 * Nested @Trace calls automatically form parent-child relationships.
 */
export function Trace(
  spanNameOrAttributes?: string | Record<string, string | number | boolean>,
  staticAttributes?: Record<string, string | number | boolean>,
) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    let spanName: string;
    let attributes: Record<string, string | number | boolean> | undefined;

    if (typeof spanNameOrAttributes === 'string') {
      spanName = spanNameOrAttributes;
      attributes = staticAttributes;
    } else if (spanNameOrAttributes) {
      spanName = propertyKey;
      attributes = spanNameOrAttributes;
    } else {
      spanName = propertyKey;
      attributes = undefined;
    }

    // Runtime Promise detection for sync/async handling
    descriptor.value = function (...args: any[]) {
      const span = tracer.startSpan(spanName, { attributes });
      const ctx = trace.setSpan(context.active(), span);

      const handleSuccess = (result: any) => {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      };

      const handleError = (error: any) => {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        span.end();
        throw error;
      };

      return context.with(ctx, () => {
        try {
          const result = originalMethod.apply(this, args);
          if (result instanceof Promise) {
            return result.then(handleSuccess, handleError);
          }
          return handleSuccess(result);
        } catch (error) {
          return handleError(error);
        }
      });
    };

    return descriptor;
  };
}

/**
 * Records method execution time as span event and attribute.
 */
export function Measure(metricName?: string) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const name = metricName || propertyKey;

    descriptor.value = function (...args: any[]) {
      const start = Date.now();
      const recordDuration = () => recordTiming(name, Date.now() - start);

      try {
        const result = originalMethod.apply(this, args);
        if (result instanceof Promise) {
          return result.finally(recordDuration);
        }
        recordDuration();
        return result;
      } catch (error) {
        recordDuration();
        throw error;
      }
    };

    return descriptor;
  };
}

/** Records timing event in current span */
export function recordTiming(name: string, durationMs: number, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, { 'duration.ms': durationMs, ...attributes });
    span.setAttribute(`timing.${name}.ms`, durationMs);
  }
}

/** Gets current active span for adding attributes */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/** Gets tracer for manual startActiveSpan calls */
export function getTracer() {
  return tracer;
}
