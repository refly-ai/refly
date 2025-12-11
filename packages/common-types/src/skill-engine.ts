/**
 * Minimal interface definitions for SkillEngine and related types.
 *
 * These interfaces are extracted here to avoid circular dependencies between:
 * - @refly/agent-tools (tools that need LLM access)
 * - @refly/skill-template (provides SkillEngine)
 *
 * By placing these interfaces in @refly/common-types, both packages can
 * depend on the types without creating a circular dependency.
 */

/**
 * Logger interface that SkillEngine uses
 */
export interface ILogger {
  log(message: any, ...optionalParams: any[]): void;
  error(message: any, ...optionalParams: any[]): void;
  warn(message: any, ...optionalParams: any[]): void;
  debug(message: any, ...optionalParams: any[]): void;
}

/**
 * Model scene types for different use cases
 */
export type ModelScene = 'chat' | 'copilot' | 'agent' | 'titleGeneration' | 'queryAnalysis';

/**
 * Parameters for creating a chat model
 */
export interface ChatModelParams {
  /**
   * Temperature for the model (0-1)
   * Lower values = more deterministic, Higher values = more creative
   */
  temperature?: number;

  /**
   * Top P sampling parameter (0-1)
   */
  topP?: number;

  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;

  /**
   * Additional parameters specific to the model provider
   */
  [key: string]: any;
}

/**
 * Minimal interface for SkillEngine that tools need to access.
 *
 * This interface defines the contract that tools can rely on when
 * they need to create LLM instances for making AI calls.
 *
 * @example
 * ```typescript
 * // In a tool implementation
 * export class MyTool extends AgentBaseTool<MyToolParams> {
 *   async _call(input: any): Promise<ToolCallResult> {
 *     if (this.params.engine) {
 *       const llm = this.params.engine.chatModel({ temperature: 0.1 });
 *       const response = await llm.invoke(messages);
 *       // Token usage is automatically tracked
 *     }
 *   }
 * }
 * ```
 */
export interface ISkillEngine {
  /**
   * Create a chat model instance with the specified parameters.
   *
   * This method creates an LLM instance that is properly configured
   * for token usage tracking and credit billing.
   *
   * @param params - Parameters for configuring the model
   * @param scene - The use case scene (determines model selection)
   * @returns A LangChain BaseChatModel instance
   *
   * @example
   * ```typescript
   * // For precise tasks like code generation
   * const llm = engine.chatModel({ temperature: 0.1 });
   *
   * // For creative tasks
   * const llm = engine.chatModel({ temperature: 0.7 });
   *
   * // With specific scene
   * const llm = engine.chatModel({ temperature: 0.1 }, 'agent');
   * ```
   */
  chatModel(params?: ChatModelParams, scene?: ModelScene): any; // Returns BaseChatModel but we use 'any' to avoid dependency

  /**
   * Refly service instance for file operations, etc.
   */
  service?: any;

  /**
   * Logger instance for debugging and monitoring
   */
  logger?: ILogger;

  /**
   * Configure the engine with runtime config
   */
  configure?(config: any): void;

  /**
   * Get configuration value by key
   */
  getConfig?(key?: string): any;
}

/**
 * Type guard to check if an object implements ISkillEngine
 */
export function isSkillEngine(obj: any): obj is ISkillEngine {
  return obj != null && typeof obj === 'object' && typeof obj.chatModel === 'function';
}
