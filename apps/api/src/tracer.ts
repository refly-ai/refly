import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
// import { PrismaInstrumentation } from '@prisma/instrumentation';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';

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

interface TracerOptions {
  otlpEndpoint?: string;
  langfuse?: {
    publicKey?: string;
    secretKey?: string;
    baseUrl?: string;
  };
}

/**
 * Initialize OpenTelemetry tracing
 * - Tempo/Grafana: receives all spans (full observability)
 * - Langfuse: receives only LLM/LangChain spans (filtered)
 */
function createLangfuseProcessor(
  config: NonNullable<TracerOptions['langfuse']>,
): SpanProcessor | null {
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
    console.log('[Tracer] Initializing Langfuse:', { baseUrl });
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

export function initTracer(options: TracerOptions): void {
  const spanProcessors: SpanProcessor[] = [];

  if (options.langfuse) {
    const processor = createLangfuseProcessor(options.langfuse);
    if (processor) spanProcessors.push(processor);
  }

  const instrumentations = [getNodeAutoInstrumentations()];

  sdk = new NodeSDK({
    traceExporter: options.otlpEndpoint
      ? new OTLPTraceExporter({ url: `${options.otlpEndpoint}/v1/traces` })
      : undefined,
    spanProcessors: spanProcessors.length > 0 ? spanProcessors : undefined,
    instrumentations,
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'reflyd',
    }),
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}

export default sdk;
