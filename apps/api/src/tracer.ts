import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { LangfuseSpanProcessor } from '@langfuse/otel';

let sdk: NodeSDK | null = null;

// Instrumentation scopes to exclude from Langfuse (infrastructure spans)
// Use exact scope names for O(1) lookup
const EXCLUDED_SCOPES = new Set([
  'prisma',
  '@opentelemetry/instrumentation-fs',
  '@opentelemetry/instrumentation-http',
  '@opentelemetry/instrumentation-https',
  '@opentelemetry/instrumentation-net',
  '@opentelemetry/instrumentation-dns',
  '@opentelemetry/instrumentation-ioredis',
]);

interface LangfuseConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

interface OtlpConfig {
  tracesUrl?: string;
  metricsUrl?: string;
  metricsIntervalMs?: number;
}

/**
 * Initialize OpenTelemetry tracing and metrics
 *
 * Supports multiple backends:
 * - OTLP Traces: Tempo/Grafana for distributed tracing
 * - OTLP Metrics: Prometheus for application metrics
 * - Langfuse: LLM/LangChain spans only (filtered)
 *
 * Each can be enabled independently via environment variables.
 * If none is configured, this function is a no-op.
 */
export function initTracer(): void {
  const otlp: OtlpConfig = {
    tracesUrl: process.env.OTLP_TRACES_URL,
    metricsUrl: process.env.OTLP_METRICS_URL,
    metricsIntervalMs: process.env.OTLP_METRICS_INTERVAL_MS
      ? Number.parseInt(process.env.OTLP_METRICS_INTERVAL_MS, 10)
      : 60000,
  };

  const langfuse: LangfuseConfig = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  };

  if (!otlp.tracesUrl && !otlp.metricsUrl && !langfuse.baseUrl) {
    return;
  }

  const spanProcessors: SpanProcessor[] = [];

  // OTLP trace exporter for Tempo/Grafana - receives all spans
  if (otlp.tracesUrl) {
    const traceExporter = new OTLPTraceExporter({ url: otlp.tracesUrl });
    spanProcessors.push(new BatchSpanProcessor(traceExporter));
  }

  // Langfuse processor - receives filtered LLM spans only
  if (langfuse.baseUrl) {
    const processor = createLangfuseProcessor(langfuse);
    if (processor) {
      spanProcessors.push(processor);
    }
  }

  // OTLP metric exporter for Prometheus - receives application metrics
  let metricReader: PeriodicExportingMetricReader | undefined;
  if (otlp.metricsUrl) {
    const metricExporter = new OTLPMetricExporter({ url: otlp.metricsUrl });
    metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: otlp.metricsIntervalMs,
    });
  }

  sdk = new NodeSDK({
    spanProcessors: spanProcessors.length > 0 ? spanProcessors : undefined,
    metricReader,
    instrumentations: [getNodeAutoInstrumentations()],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'reflyd',
    }),
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk?.shutdown().finally(() => process.exit(0));
  });
}

function createLangfuseProcessor(config: LangfuseConfig): SpanProcessor | null {
  const { publicKey, secretKey, baseUrl } = config;

  if (!publicKey || !secretKey || !baseUrl) {
    return null;
  }

  try {
    return new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      shouldExportSpan: ({ otelSpan }) =>
        !EXCLUDED_SCOPES.has(otelSpan.instrumentationScope?.name ?? ''),
      // Slim down resourceAttributes in trace/observation metadata
      // Note: mask receives serialized JSON strings, operates on values not keys
      // Key-based filtering (langgraph_*, ls_*) is done in FilteredLangfuseCallbackHandler
      mask: ({ data }) => {
        if (typeof data !== 'string') return data;

        try {
          const parsed = JSON.parse(data);
          if (typeof parsed !== 'object' || parsed === null) return data;

          // Slim down resourceAttributes if present (verbose OTEL attributes)
          if (parsed.resourceAttributes && typeof parsed.resourceAttributes === 'object') {
            const KEPT_RESOURCE_ATTRS = new Set([
              'service.name',
              'host.name',
              'process.runtime.version',
            ]);
            const slimmed = {
              ...parsed,
              resourceAttributes: Object.fromEntries(
                Object.entries(parsed.resourceAttributes as Record<string, unknown>).filter(([k]) =>
                  KEPT_RESOURCE_ATTRS.has(k),
                ),
              ),
            };
            return JSON.stringify(slimmed);
          }

          return data;
        } catch {
          return data;
        }
      },
    });
  } catch (_error) {
    return null;
  }
}

export default sdk;
