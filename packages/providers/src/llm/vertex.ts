import type { BaseMessage } from '@langchain/core/messages';
import type { ChatGenerationChunk } from '@langchain/core/outputs';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { guard, type RetryConfig } from '@refly/utils';

/**
 * Default retryable network error codes for Vertex AI
 * Based on common network errors that can be safely retried
 */
const RETRYABLE_ERROR_PATTERNS = [
  'socket hang up',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
];

/**
 * Check if an error is retryable based on error message patterns
 */
const isRetryableError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) =>
    errorMessage?.toLowerCase()?.includes(pattern?.toLowerCase()),
  );
};

/**
 * Create retry configuration for Vertex AI with logging
 */
const createRetryConfig = (context: string): RetryConfig => ({
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
  retryIf: isRetryableError,
  onRetry: (error, attempt) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `[EnhancedChatVertexAI] Vertex AI ${context} failed (attempt ${attempt}/3): ${errorMessage}. Retrying...`,
    );
  },
});

/**
 * Enhanced ChatVertexAI with automatic retry logic for network errors
 *
 * This wrapper adds exponential backoff retry for transient network errors.
 */
export class EnhancedChatVertexAI extends ChatVertexAI {
  /**
   * Override _generate to add retry logic for non-streaming calls
   */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: any,
  ): Promise<any> {
    return await guard
      .retry(() => super._generate(messages, options, runManager), createRetryConfig('request'))
      .orThrow();
  }

  /**
   * Override _streamResponseChunks to add retry logic for streaming calls
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: any,
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* guard.retryGenerator(
      () => super._streamResponseChunks(messages, options, runManager),
      createRetryConfig('streaming request'),
    );
  }
}

/**
 * Check if the given LLM is a Gemini model (Vertex AI)
 * This includes ChatVertexAI and all its subclasses (e.g., EnhancedChatVertexAI)
 *
 * @param llm - The language model to check
 * @returns true if the model is a Gemini/Vertex AI model
 */
export function isGeminiModel(llm: any): boolean {
  return llm instanceof ChatVertexAI;
}
