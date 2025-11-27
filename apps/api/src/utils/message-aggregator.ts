import { Prisma, PrismaClient } from '@prisma/client';
import { genActionMessageID } from '@refly/utils';
import { ActionMessageType, ToolCallMeta } from '@refly/openapi-schema';

/**
 * Message entry structure for tracking messages during skill execution
 */
interface MessageEntry {
  messageId: string;
  type: ActionMessageType;
  content?: string;
  reasoningContent?: string;
  usageMeta?: {
    inputTokens: number;
    outputTokens: number;
  };
  toolCallMeta?: ToolCallMeta;
  toolCallId?: string;
  createdAt: Date;
  dirty: boolean;
  persisted: boolean;
}

/**
 * Current AI message state for streaming accumulation
 */
interface CurrentAIMessageState {
  messageId: string;
  content: string;
  reasoningContent: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  usageMetadata?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Configuration for MessageAggregator auto-save behavior
 */
interface MessageAggregatorConfig {
  /** Auto-save interval in milliseconds (default: 3000ms) */
  autoSaveInterval?: number;
  /** Disable auto-save (default: false) */
  disableAutoSave?: boolean;
}

const DEFAULT_AUTO_SAVE_INTERVAL = 3000;

/**
 * MessageAggregator tracks and accumulates messages during skill execution
 * It handles the sequential order of messages and supports streaming content
 * It also periodically persists messages to the database
 */
export class MessageAggregator {
  private messages: MessageEntry[] = [];
  private currentAIMessage: CurrentAIMessageState | null = null;
  private aborted = false;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(
    private readonly resultId: string,
    private readonly version: number,
    private readonly prisma?: PrismaClient,
    private readonly config: MessageAggregatorConfig = {},
  ) {
    // Start auto-save timer if prisma is provided and auto-save is not disabled
    if (this.prisma && !this.config.disableAutoSave) {
      this.startAutoSaveTimer();
    }
  }

  /**
   * Start the auto-save timer for periodic persistence
   */
  private startAutoSaveTimer(): void {
    const interval = this.config.autoSaveInterval ?? DEFAULT_AUTO_SAVE_INTERVAL;
    this.autoSaveTimer = setInterval(() => {
      this.persistDirtyMessages().catch((error) => {
        console.error('[MessageAggregator] Auto-save failed:', error);
      });
    }, interval);
  }

  /**
   * Stop the auto-save timer
   */
  private stopAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Persist all dirty messages to the database
   */
  private async persistDirtyMessages(): Promise<void> {
    if (!this.prisma || this.isFlushing) return;

    const dirtyMessages = this.messages.filter((msg) => msg.dirty);
    if (dirtyMessages.length === 0) return;

    try {
      const newMessages = dirtyMessages.filter((msg) => !msg.persisted);
      const updatedMessages = dirtyMessages.filter((msg) => msg.persisted);

      // Create new messages
      if (newMessages.length > 0) {
        const createData = newMessages.map((msg) => this.toPrismaInput(msg));
        await this.prisma.actionMessage.createMany({ data: createData });

        // Mark as persisted
        for (const msg of newMessages) {
          msg.persisted = true;
          msg.dirty = false;
        }
      }

      // Update existing messages one by one (batch update not supported for different data)
      for (const msg of updatedMessages) {
        await this.prisma.actionMessage.update({
          where: { messageId: msg.messageId },
          data: {
            content: msg.content ?? '',
            reasoningContent: msg.reasoningContent,
            usageMeta: msg.usageMeta ? JSON.stringify(msg.usageMeta) : null,
            toolCallMeta: msg.toolCallMeta ? JSON.stringify(msg.toolCallMeta) : null,
          },
        });
        msg.dirty = false;
      }
    } catch (error) {
      console.error('[MessageAggregator] Failed to persist dirty messages:', error);
      throw error;
    }
  }

  /**
   * Convert a message entry to Prisma create input
   */
  private toPrismaInput(msg: MessageEntry): Prisma.ActionMessageCreateManyInput {
    return {
      messageId: msg.messageId,
      resultId: this.resultId,
      version: this.version,
      type: msg.type,
      content: msg.content ?? '',
      reasoningContent: msg.reasoningContent,
      usageMeta: msg.usageMeta ? JSON.stringify(msg.usageMeta) : null,
      toolCallMeta: msg.toolCallMeta ? JSON.stringify(msg.toolCallMeta) : null,
      toolCallId: msg.toolCallId,
    };
  }

  /**
   * Mark the aggregator as aborted
   */
  abort(): void {
    this.aborted = true;
    this.stopAutoSaveTimer();
  }

  /**
   * Check if the aggregator is aborted
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Start a new AI message (called when LLM starts streaming)
   */
  startAIMessage(): void {
    if (this.aborted) return;

    // Finalize any previous AI message
    this.finalizeCurrentAIMessage();

    this.currentAIMessage = {
      messageId: genActionMessageID(),
      content: '',
      reasoningContent: '',
      toolCalls: [],
    };
  }

  /**
   * Append content to the current AI message during streaming
   */
  appendToAIMessage(content: string, reasoningContent?: string): void {
    if (this.aborted || !this.currentAIMessage) return;

    this.currentAIMessage.content += content;
    if (reasoningContent) {
      this.currentAIMessage.reasoningContent += reasoningContent;
    }
  }

  /**
   * Set usage metadata for the current AI message
   */
  setAIMessageUsage(inputTokens: number, outputTokens: number): void {
    if (this.aborted || !this.currentAIMessage) return;

    this.currentAIMessage.usageMetadata = {
      inputTokens,
      outputTokens,
    };
  }

  /**
   * Finalize the current AI message and add it to the messages list
   */
  finalizeCurrentAIMessage(): void {
    if (this.aborted || !this.currentAIMessage) return;

    // Only add if there's actual content or tool calls
    if (
      this.currentAIMessage.content ||
      this.currentAIMessage.reasoningContent ||
      this.currentAIMessage.toolCalls.length > 0
    ) {
      const messageEntry: MessageEntry = {
        messageId: this.currentAIMessage.messageId,
        type: 'ai',
        content: this.currentAIMessage.content,
        reasoningContent: this.currentAIMessage.reasoningContent,
        createdAt: new Date(),
        dirty: true,
        persisted: false,
      };

      if (this.currentAIMessage.usageMetadata) {
        messageEntry.usageMeta = this.currentAIMessage.usageMetadata;
      }

      this.messages.push(messageEntry);
    }

    this.currentAIMessage = null;
  }

  /**
   * Add a ToolMessage when a tool execution completes
   * If a message with the same toolCallId already exists, update it instead of adding a new one
   * Returns the messageId of the tool message
   */
  addToolMessage(params: { toolCallId: string; toolCallMeta: ToolCallMeta }): string {
    if (this.aborted) return '';

    // Finalize any pending AI message before adding tool result
    this.finalizeCurrentAIMessage();

    // Check if a message with the same toolCallId already exists
    const existingIndex = this.messages.findIndex(
      (msg) => msg.type === 'tool' && msg.toolCallId === params.toolCallId,
    );

    if (existingIndex >= 0) {
      // Update existing message
      const existingMessage = this.messages[existingIndex];
      if (existingMessage.type === 'tool') {
        this.messages[existingIndex] = {
          ...existingMessage,
          toolCallMeta: {
            ...existingMessage.toolCallMeta,
            ...params.toolCallMeta,
          },
          dirty: true,
        };
        return existingMessage.messageId;
      }
    }

    // Add new message
    const messageId = genActionMessageID();
    this.messages.push({
      messageId,
      type: 'tool',
      toolCallId: params.toolCallId,
      toolCallMeta: params.toolCallMeta,
      createdAt: new Date(),
      dirty: true,
      persisted: false,
    });
    return messageId;
  }

  /**
   * Get messages as Prisma create many input
   * Note: This is kept for backward compatibility
   */
  getMessagesAsPrismaInput(): Prisma.ActionMessageCreateManyInput[] {
    return this.messages.map((msg) => this.toPrismaInput(msg));
  }

  /**
   * Get only unpersisted messages as Prisma create many input
   * This is useful when prisma is injected and auto-save is enabled
   */
  getUnpersistedMessagesAsPrismaInput(): Prisma.ActionMessageCreateManyInput[] {
    return this.messages.filter((msg) => !msg.persisted).map((msg) => this.toPrismaInput(msg));
  }

  /**
   * Get the count of messages
   */
  getMessageCount(): number {
    return this.messages.length + (this.currentAIMessage ? 1 : 0);
  }

  /**
   * Check if there's a current AI message being accumulated
   */
  hasCurrentAIMessage(): boolean {
    return this.currentAIMessage !== null;
  }

  /**
   * Get the current AI message's messageId
   * Returns undefined if no AI message is currently being accumulated
   */
  getCurrentAIMessageId(): string | undefined {
    return this.currentAIMessage?.messageId;
  }

  /**
   * Clear all messages (useful for retry scenarios)
   */
  clear(): void {
    this.messages = [];
    this.currentAIMessage = null;
  }

  /**
   * Flush all pending messages to the database
   * This should be called when the skill invoker finishes execution
   * to ensure all messages are persisted
   */
  async flush(): Promise<void> {
    // Stop auto-save timer first
    this.stopAutoSaveTimer();

    // Finalize any pending AI message
    this.finalizeCurrentAIMessage();

    if (!this.prisma) {
      return;
    }

    this.isFlushing = true;

    try {
      await this.persistDirtyMessages();
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Check if all messages have been persisted
   */
  isFullyPersisted(): boolean {
    return this.messages.every((msg) => msg.persisted && !msg.dirty);
  }

  /**
   * Get the count of dirty (unpersisted or modified) messages
   */
  getDirtyCount(): number {
    return this.messages.filter((msg) => msg.dirty).length;
  }

  /**
   * Dispose the aggregator and clean up resources
   */
  dispose(): void {
    this.stopAutoSaveTimer();
  }
}
