// Import types and classes
import {
  LangfuseClientManager,
  type LangfuseConfig,
  type SecurityFilterConfig,
} from './langfuse-client';
import { TraceManager } from './trace-manager';

// Export main classes and interfaces
export { LangfuseClientManager, SecurityFilter } from './langfuse-client';
export { TraceManager } from './trace-manager';
export { LangfuseService } from './langfuse.service';

// Export types
export type {
  LangfuseConfig,
  SecurityFilterConfig,
} from './langfuse-client';

export type {
  TraceMetadata,
  SpanData,
  GenerationData,
} from './trace-manager';

// Export LangChain callback handlers
export {
  getLangfuseCallbackHandler,
  getLangfuseCallbackHandlerWithMetadata,
  createLangfuseCallbacks,
} from './langchain-callback';

// Convenience function to initialize the observability system
export function initializeObservability(
  langfuseConfig: LangfuseConfig,
  securityConfig?: SecurityFilterConfig,
): void {
  const clientManager = LangfuseClientManager.getInstance();
  clientManager.initialize(langfuseConfig, securityConfig);
}

// Convenience function to get the trace manager
export function getTraceManager(): TraceManager {
  return new TraceManager();
}

// Convenience function to shutdown observability
export async function shutdownObservability(): Promise<void> {
  const clientManager = LangfuseClientManager.getInstance();
  await clientManager.shutdown();
}

export { LangfuseListener, createLangfuseService } from './langfuse-listener';
export { OpenTelemetryListener } from './types';
