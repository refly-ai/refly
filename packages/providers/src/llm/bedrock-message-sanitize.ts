import { AIMessage, BaseMessage } from '@langchain/core/messages';

type ReasoningText = {
  text?: string | null;
  signature?: string | null;
};

type ContentBlock = {
  type?: string;
  text?: string;
  reasoningText?: ReasoningText;
  redactedContent?: string;
  cachePoint?: unknown;
  [key: string]: unknown;
};

/**
 * Bedrock Converse rejects assistant turns where
 * `reasoningContent.reasoningText.text` is null/missing.
 *
 * Claude Sonnet 5 (and similar) can emit signature-only or null-text
 * reasoning blocks on tool-use turns. @langchain/aws forwards them
 * unchanged on the next agent-loop invoke → ValidationException.
 *
 * Coerce null/undefined text to "" when a reasoningText object is kept;
 * drop empty reasoning blocks that have neither text nor signature nor
 * redacted content.
 */
export const sanitizeReasoningContentBlocks = (content: unknown): unknown => {
  if (!Array.isArray(content)) {
    return content;
  }

  const sanitized: ContentBlock[] = [];

  for (const raw of content as ContentBlock[]) {
    if (!raw || typeof raw !== 'object') {
      sanitized.push(raw);
      continue;
    }

    if (raw.type !== 'reasoning_content') {
      sanitized.push(raw);
      continue;
    }

    if ('redactedContent' in raw && raw.redactedContent != null) {
      sanitized.push(raw);
      continue;
    }

    if (!('reasoningText' in raw) || raw.reasoningText == null) {
      // Invalid / empty reasoning block — drop rather than send null text.
      continue;
    }

    const { text, signature } = raw.reasoningText;
    const hasSignature = typeof signature === 'string' && signature.length > 0;
    const normalizedText = text == null ? '' : String(text);

    // Drop completely empty reasoning shells (no text, no signature).
    if (!normalizedText && !hasSignature) {
      continue;
    }

    sanitized.push({
      ...raw,
      type: 'reasoning_content',
      reasoningText: {
        ...raw.reasoningText,
        // Bedrock requires text to be a non-null string when reasoningText is present.
        text: normalizedText,
        ...(signature != null ? { signature: String(signature) } : {}),
      },
    });
  }

  return sanitized;
};

/**
 * Returns a new message list safe for Bedrock Converse replay.
 * Only AI messages with array content are rewritten.
 */
export const sanitizeBedrockReplayMessages = (messages: BaseMessage[]): BaseMessage[] => {
  return messages.map((message) => {
    if (!AIMessage.isInstance(message)) {
      return message;
    }

    if (!Array.isArray(message.content)) {
      return message;
    }

    const prev = message.content as ContentBlock[];
    const next = sanitizeReasoningContentBlocks(message.content) as ContentBlock[];
    // Skip rewrite when every block is unchanged by identity (no reasoning fixes needed).
    const unchanged = prev.length === next.length && prev.every((block, i) => block === next[i]);
    if (unchanged) {
      return message;
    }

    return new AIMessage({
      content: next as AIMessage['content'],
      tool_calls: message.tool_calls,
      invalid_tool_calls: message.invalid_tool_calls,
      usage_metadata: message.usage_metadata,
      additional_kwargs: message.additional_kwargs,
      response_metadata: message.response_metadata,
      id: message.id,
      name: message.name,
    });
  });
};

/**
 * Inspect converse-style payload (post @langchain/aws conversion) and
 * report whether any reasoningText.text is null/undefined.
 * Used by tests to reproduce the Bedrock ValidationException condition.
 */
export const findNullReasoningTextPaths = (
  converseMessages: Array<{
    role?: string;
    content?: Array<Record<string, unknown>>;
  }>,
): string[] => {
  const paths: string[] = [];
  converseMessages.forEach((msg, mi) => {
    msg.content?.forEach((block, bi) => {
      const reasoning = block?.reasoningContent as
        | { reasoningText?: { text?: string | null } }
        | undefined;
      if (!reasoning || !('reasoningText' in reasoning)) {
        return;
      }
      const text = reasoning.reasoningText?.text;
      if (text == null) {
        paths.push(`messages.${mi}.content.${bi}.reasoningContent.reasoningText.text`);
      }
    });
  });
  return paths;
};
