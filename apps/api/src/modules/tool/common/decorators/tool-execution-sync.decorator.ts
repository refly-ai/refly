/**
 * Tool Execution Sync Decorator
 *
 * This decorator provides automatic handling of tool execution workflows including:
 * - ActionResult creation and management
 * - Workflow node execution tracking
 * - Parent-child relationship handling
 * - Canvas node creation and connection
 * - Status updates (waiting -> executing -> finish/failed)
 *
 * Usage:
 * ```typescript
 * @ToolExecutionSync({
 *   resultType: 'audio',
 *   getParentResultId: (req) => req.parentResultId,
 *   getTitle: (req) => req.prompt || req.text,
 * })
 * async generateAudio(user: User, request: AudioRequest): Promise<AudioResponse> {
 *   // Only implement the core execution logic
 *   return await this.executeGeneration(user, request);
 * }
 * ```
 */

export interface ToolExecutionSyncOptions {
  /**
   * Type of result/node being generated (audio, video, image, document, code, etc.)
   */
  resultType: string;

  /**
   * Function to extract parentResultId from request
   */
  getParentResultId: (request: any) => string | undefined;

  /**
   * Function to extract title/prompt from request
   */
  getTitle: (request: any) => string;

  /**
   * Function to extract model name from request (optional)
   */
  getModel?: (request: any) => string | undefined;

  /**
   * Function to extract provider item ID from request (optional)
   */
  getProviderItemId?: (request: any) => string | undefined;

  /**
   * Whether to create canvas node automatically (default: true)
   */
  createCanvasNode?: boolean;

  /**
   * Whether to update workflow node execution (default: true)
   */
  updateWorkflowNode?: boolean;

  /**
   * Custom metadata extractor (optional)
   */
  getMetadata?: (request: any, result: any) => Record<string, any>;
}

/**
 * Decorator factory for tool execution methods with automatic sync
 */
export function ToolExecutionSync(options: ToolExecutionSyncOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract user and request from arguments (assumes first two args are user and request)
      const [user, request] = args;

      // Get the interceptor instance from the service (injected via constructor)
      const interceptor = this.toolExecutionSync;

      if (!interceptor) {
        throw new Error(
          'ToolExecutionSyncInterceptor not found. Please inject it in the constructor as "toolExecutionSync"',
        );
      }

      // Use the interceptor to handle all boilerplate
      return await interceptor.intercept(
        {
          user,
          request,
          options,
        },
        // Pass the original method as the core execution function
        async () => {
          return await originalMethod.apply(this, args);
        },
      );
    };

    // Store metadata for the interceptor to use (for potential introspection)
    Reflect.defineMetadata('toolExecution:sync:options', options, target, propertyKey);

    return descriptor;
  };
}

// Backward compatibility aliases
export const MediaGeneration = ToolExecutionSync;
export type MediaGenerationOptions = ToolExecutionSyncOptions;
