import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
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
  endpoint?: string;
}

/**
 * Initialize OpenTelemetry tracing
 *
 * Supports two independent backends:
 * - Tempo/Grafana (OTLP): receives all spans for full observability
 * - Langfuse: receives only LLM/LangChain spans (filtered via shouldExportSpan)
 *
 * Either or both can be enabled independently via environment variables.
 * If neither is configured, this function is a no-op.
 */
export function initTracer(): void {
  const otlp: OtlpConfig = {
    endpoint: process.env.OTLP_TRACES_ENDPOINT,
  };

  const langfuse: LangfuseConfig = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  };

  if (!otlp.endpoint && !langfuse.baseUrl) {
    console.log('[Tracer] No tracing backend configured, skipping initialization');
    return;
  }

  const spanProcessors: SpanProcessor[] = [];

  // OTLP exporter for Tempo/Grafana - receives all spans
  if (otlp.endpoint) {
    const otlpExporter = new OTLPTraceExporter({ url: `${otlp.endpoint}/v1/traces` });
    spanProcessors.push(new BatchSpanProcessor(otlpExporter));
    console.log('[Tracer] OTLP exporter configured:', { endpoint: otlp.endpoint });
  }

  // Langfuse processor - receives filtered LLM spans only
  if (langfuse.baseUrl) {
    const processor = createLangfuseProcessor(langfuse);
    if (processor) spanProcessors.push(processor);
  }

  sdk = new NodeSDK({
    spanProcessors: spanProcessors.length > 0 ? spanProcessors : undefined,
    instrumentations: [getNodeAutoInstrumentations()],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'reflyd',
    }),
  });

  sdk.start();
  console.log('[Tracer] OpenTelemetry SDK started');

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('[Tracer] Tracing terminated'))
      .catch((error) => console.log('[Tracer] Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}

function createLangfuseProcessor(config: LangfuseConfig): SpanProcessor | null {
  const { publicKey, secretKey, baseUrl } = config;

  if (!publicKey || !secretKey || !baseUrl) {
    console.error('[Tracer] Langfuse missing required config:', {
      hasPublicKey: !!publicKey,
      hasSecretKey: !!secretKey,
      hasBaseUrl: !!baseUrl,
    });
    return null;
  }

  try {
    console.log('[Tracer] Langfuse processor configured:', { baseUrl });
    return new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      shouldExportSpan: ({ otelSpan }) =>
        !EXCLUDED_SCOPES.has(otelSpan.instrumentationScope?.name ?? ''),
    });
  } catch (error) {
    console.error('[Tracer] Failed to initialize Langfuse:', error);
    return null;
  }
}

export default sdk;
