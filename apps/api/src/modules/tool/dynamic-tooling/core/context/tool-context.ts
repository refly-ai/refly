/**
 * Request context management using AsyncLocalStorage
 * Provides thread-safe access to current request's user information
 * Integrates seamlessly with LangChain's RunnableConfig context
 */
import { User } from '@refly/openapi-schema';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RunnableConfig } from '@langchain/core/runnables';

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
   * LangChain RunnableConfig (when running within LangChain context)
   */
  langchainConfig?: SkillRunnableConfig;
}

/**
 * Extended LangChain config with custom configurable fields
 */
export interface SkillRunnableConfig extends RunnableConfig {
  configurable?: {
    user?: User;
    canvasId?: string;
    resultId?: string;
    [key: string]: unknown;
  };
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
 * Set LangChain config in current context
 * This is automatically called by tool handlers when executing from LangChain
 */
export function setLangChainConfig(config: SkillRunnableConfig | undefined): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.langchainConfig = config;
  }
}

/**
 * Get LangChain config from current execution context
 */
export function getLangChainConfig(): SkillRunnableConfig | undefined {
  return asyncLocalStorage.getStore()?.langchainConfig;
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
 * Set user in current context (if context exists)
 */
export function setCurrentUser(user: User | undefined): void {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.user = user;
  }
}

/**
 * Get request ID from context
 */
export function getRequestId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return undefined;
  }
  // Priority 1: Direct requestId field
  if (context.requestId) {
    return context.requestId;
  }
}

/**
 * Check if we're currently in a request context
 */
export function hasContext(): boolean {
  return asyncLocalStorage.getStore() !== undefined;
}

/**
 * Get canvas ID from context
 * Tries direct canvasId field first, then falls back to LangChain config
 */
export function getCanvasId(): string | undefined {
  const context = asyncLocalStorage.getStore();
  return context.langchainConfig?.configurable?.canvasId;
}
