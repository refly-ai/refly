/**
 * Request context management using AsyncLocalStorage
 * Provides thread-safe access to current request's user information
 * Integrates seamlessly with LangChain's RunnableConfig context
 */
import { User } from '@refly/openapi-schema';
import { AsyncLocalStorage } from 'node:async_hooks';
import { SkillRunnableConfig } from '@refly/skill-template';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

export interface RequestContext {
  /**
   * Current user making the request
   */
  user?: User;

  /**
   * Request ID for tracking
   */
  requestId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Canvas ID associated with the request
   */
  canvasId?: string;

  /**
   * Result ID associated with the request
   */
  resultId?: string;

  /**
   * Run manager associated with the request
   */
  runManager?: CallbackManagerForToolRun;

  /**
   * LangChain RunnableConfig (when running within LangChain context)
   */
  langchainConfig?: SkillRunnableConfig;
}

/**
 * Global AsyncLocalStorage instance for request context
 * This single storage handles both manual contexts and LangChain contexts
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with a specific request context
 */
export function runInContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get the current request context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current user from context
 * Tries direct user field first, then falls back to LangChain config
 */
export function getCurrentUser(): User | undefined {
  const context = asyncLocalStorage.getStore();
  // Priority 2: LangChain config
  return context.langchainConfig?.configurable?.user;
}

/**
 * Get canvas ID from context
 * Tries direct canvasId field first, then falls back to LangChain config
 */
export function getCanvasId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.langchainConfig?.configurable?.canvasId;
}

export function getToolCallId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.runManager?.runId;
}

/**
 * Get result ID from context
 * Returns the agent result ID from LangChain config
 */
export function getResultId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.langchainConfig?.configurable?.resultId;
}

/**
 * Get result version from context
 * Returns the agent result version from LangChain config
 */
export function getResultVersion(): number | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.langchainConfig?.configurable?.version as number | undefined;
}

/**
 * Get tool name from context metadata
 * Returns the current tool/method name being executed
 */
export function getToolName(): string {
  const context = asyncLocalStorage.getStore();
  return (context?.metadata?.toolName as string) ?? '';
}

/**
 * Get toolset key from context metadata
 * Returns the current toolset key being executed (e.g., 'volcengine', 'heygen')
 */
export function getToolsetKey(): string {
  const context = asyncLocalStorage.getStore();
  return (context?.metadata?.toolsetKey as string) ?? '';
}
