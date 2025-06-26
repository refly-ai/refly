import { Span } from '@opentelemetry/api';

export interface OpenTelemetryListener {
  onSpanStart(span: Span): void;
  onSpanEnd(span: Span): void;
  onSpanError(span: Span, error: Error): void;
  flush(): Promise<void>;
}
