import type { Response } from 'express';
import type { SkillEvent } from '@refly/openapi-schema';
import { writeSSEResponse } from './response';

/**
 * SSE stream buffer configuration
 */
export interface StreamBufferConfig {
  /**
   * Buffer time window in milliseconds
   */
  bufferTimeMs?: number;

  /**
   * Maximum buffer size in characters, flush immediately when reached
   * Prevents sending too much content at once which may cause stuttering
   */
  maxBufferSize?: number;

  /**
   * Flush immediately when encountering punctuation
   * Allows users to see complete semantic units at sentence boundaries
   */
  flushOnPunctuation?: boolean;

  /**
   * Flush immediately when encountering newlines
   * Maintains paragraph integrity
   */
  flushOnNewline?: boolean;

  /**
   * Maximum wait time in milliseconds, force flush even if buffer is not full
   * Prevents long periods without response
   */
  maxWaitMs?: number;
}

/**
 * Chinese and English punctuation regex
 */
const PUNCTUATION_REGEX = /[。！？；，、：""''（）【】《》\.\!\?\;,:\(\)\[\]]/;

/**
 * Default configuration for stream buffer
 */
const DEFAULT_CONFIG: Required<StreamBufferConfig> = {
  bufferTimeMs: 200,
  maxBufferSize: 15,
  flushOnPunctuation: true,
  flushOnNewline: true,
  maxWaitMs: 400,
};

/**
 * SSE stream buffer
 * Optimizes LLM streaming output user experience by reducing network requests and improving rendering smoothness
 */
export class StreamBuffer {
  private buffer = '';
  private reasoningBuffer = '';
  private timer: NodeJS.Timeout | null = null;
  private lastFlushTime = Date.now();

  private config: Required<StreamBufferConfig>;

  constructor(
    private res: Response | undefined,
    private baseEvent: Omit<SkillEvent, 'content' | 'reasoningContent'>,
    config?: StreamBufferConfig,
  ) {
    // Merge with default configuration
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Update base event metadata (e.g., step info)
   */
  updateBaseEvent(updates: Partial<Omit<SkillEvent, 'content' | 'reasoningContent'>>): void {
    this.baseEvent = {
      ...this.baseEvent,
      ...updates,
    };
  }

  /**
   * Add content to buffer
   */
  push(content: string, reasoningContent?: string): void {
    if (!this.res) {
      return;
    }

    // Accumulate content
    this.buffer += content;
    if (reasoningContent) {
      this.reasoningBuffer += reasoningContent;
    }

    // Determine if immediate flush is needed
    const shouldFlushImmediately =
      // Buffer size reached threshold
      this.buffer.length >= this.config.maxBufferSize ||
      // Encountered punctuation
      (this.config.flushOnPunctuation && PUNCTUATION_REGEX.test(content)) ||
      // Encountered newline
      (this.config.flushOnNewline && content.includes('\n'));

    if (shouldFlushImmediately) {
      this.flush();
      return;
    }

    // Check if maximum wait time exceeded
    const timeSinceLastFlush = Date.now() - this.lastFlushTime;
    if (timeSinceLastFlush >= this.config.maxWaitMs) {
      this.flush();
      return;
    }

    // Schedule timed flush
    this.scheduleFlush();
  }

  /**
   * Schedule timed flush
   */
  private scheduleFlush(): void {
    if (this.timer) {
      return; // Timer already running
    }

    this.timer = setTimeout(() => {
      this.flush();
    }, this.config.bufferTimeMs);
  }

  /**
   * Flush buffer immediately
   */
  flush(): void {
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Don't send if buffer is empty
    if (!this.buffer && !this.reasoningBuffer) {
      return;
    }

    // Send SSE event
    if (this.res) {
      writeSSEResponse(this.res, {
        ...this.baseEvent,
        content: this.buffer,
        reasoningContent: this.reasoningBuffer || '',
      } as SkillEvent);
    }

    // Clear buffer
    this.buffer = '';
    this.reasoningBuffer = '';
    this.lastFlushTime = Date.now();
  }

  /**
   * Destroy buffer and cleanup all timers
   */
  destroy(): void {
    // Flush remaining content
    this.flush();

    // Cleanup timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
