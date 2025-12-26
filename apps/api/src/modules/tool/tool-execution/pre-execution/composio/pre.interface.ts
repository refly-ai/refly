import type { HandlerRequest, JsonSchema } from '@refly/openapi-schema';
import type { RequestContext } from '../../../tool-context';

/**
 * Context for pre-handler processing
 * Uses the standardized RequestContext from tool-context
 */
export type PreHandlerContext = RequestContext;

/**
 * Input for pre-handler processing
 */
export interface PreHandlerInput {
  toolName: string;
  toolsetKey: string;
  request: HandlerRequest;
  schema: JsonSchema;
  context: PreHandlerContext;
}

/**
 * Output from pre-handler processing
 * Contains modified request and cleanup function
 */
export interface PreHandlerOutput {
  request: HandlerRequest;
  cleanup: () => Promise<void>;
  success: boolean;
  error?: string;
}

/**
 * Interface for tool pre-handlers
 */
export interface IToolPreHandler {
  process(input: PreHandlerInput): Promise<PreHandlerOutput>;
}
