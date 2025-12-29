import {
  ChatOpenAI,
  ChatOpenAICallOptions,
  ChatOpenAICompletions,
  ChatOpenAIFields,
  OpenAIClient,
} from '@langchain/openai';

class EnhanceChatOpenAICompletions extends ChatOpenAICompletions {
  protected override _convertCompletionsDeltaToBaseMessageChunk(
    delta: Record<string, any>,
    rawResponse: OpenAIClient.ChatCompletionChunk,
    defaultRole?: 'function' | 'user' | 'system' | 'developer' | 'assistant' | 'tool',
  ) {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole,
    );
    if (messageChunk) {
      messageChunk.additional_kwargs = messageChunk.additional_kwargs ?? {};
      messageChunk.additional_kwargs.reasoning_content = delta.reasoning;
    }
    return messageChunk;
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.ChatCompletionMessage,
    rawResponse: OpenAIClient.ChatCompletion,
  ) {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(message, rawResponse);
    if (langChainMessage) {
      langChainMessage.additional_kwargs = langChainMessage.additional_kwargs ?? {};
      langChainMessage.additional_kwargs.reasoning_content = (message as any).reasoning_content;
    }
    return langChainMessage;
  }
}

export class EnhancedChatOpenAI extends ChatOpenAI<ChatOpenAICallOptions> {
  constructor(fields?: Partial<ChatOpenAIFields>) {
    super({
      ...fields,
      completions: new EnhanceChatOpenAICompletions(fields),
    });
  }
}
