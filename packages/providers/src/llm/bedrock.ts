import { ChatBedrockConverse } from '@langchain/aws';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk, ChatResult } from '@langchain/core/outputs';
import { sanitizeBedrockReplayMessages } from './bedrock-message-sanitize';

/**
 * ChatBedrockConverse that sanitizes assistant reasoning blocks before
 * every request. Prevents Bedrock ValidationException when Claude Sonnet 5
 * (and similar) emit signature-only / null-text reasoning on tool-use turns
 * that are replayed in the agent loop.
 */
export class SanitizingChatBedrockConverse extends ChatBedrockConverse {
  override async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    return super._generate(sanitizeBedrockReplayMessages(messages), options, runManager);
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* super._streamResponseChunks(
      sanitizeBedrockReplayMessages(messages),
      options,
      runManager,
    );
  }
}
