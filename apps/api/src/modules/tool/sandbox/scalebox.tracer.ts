import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

/** OpenTelemetry tracer for sandbox operations */
const tracer = trace.getTracer('scalebox', '1.0.0');

/**
 * Creates spans for method execution
 * @param spanNameOrAttributes - Span name (string) or attributes (object, uses method name as span)
 * @param staticAttributes - Optional attributes when first param is string
 */
export function Trace(
  spanNameOrAttributes?: string | Record<string, string | number | boolean>,
  staticAttributes?: Record<string, string | number | boolean>,
) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    // Determine span name and attributes
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

    // Use function (not arrow) to preserve `this` binding for method calls
    descriptor.value = async function (...args: any[]) {
      return tracer.startActiveSpan(spanName, { attributes }, async (span: Span) => {
        try {
          const result = await originalMethod.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Tracks method execution time and records as span attribute
 * @param metricName - Optional metric name, defaults to method name
 */
export function Measure(metricName?: string) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const name = metricName || propertyKey;

    // Use function (not arrow) to preserve `this` binding for method calls
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = Date.now() - start;
        recordTiming(name, duration);
      }
    };

    return descriptor;
  };
}

/** Records timing event in current span */
export function recordTiming(name: string, durationMs: number, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, {
      'duration.ms': durationMs,
      ...attributes,
    });
    span.setAttribute(`timing.${name}.ms`, durationMs);
  }
}

/** Gets current active span */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}
