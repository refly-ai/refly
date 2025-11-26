import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: opentelemetry.NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 * @param endpoint OTLP traces endpoint (e.g., http://localhost:34318)
 */
export function initTracer(endpoint: string): void {
  const exporterOptions = {
    url: `${endpoint}/v1/traces`,
  };

  const traceExporter = new OTLPTraceExporter(exporterOptions);
  sdk = new opentelemetry.NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'reflyd',
    }),
  });

  sdk.start();

  // Gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}

export default sdk;
