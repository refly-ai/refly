import { encode } from 'gpt-tokenizer';
import { BaseMessage, MessageContent } from '@langchain/core/messages';
import { SkillContext } from '@refly/openapi-schema';
import { truncateContent as baseTruncateContent } from '@refly/utils';

// ============================================================================
// Token Estimation (Fast, ~1000x faster than exact counting)
// ============================================================================

/**
 * Estimate tokens using character count heuristic.
 * Average ratio: ~3.5 chars per token for mixed English/code content
 * This is ~1000x faster than actual tokenization.
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Fast token estimation for MessageContent
 */
export const estimateToken = (content: MessageContent): number => {
  const inputText = Array.isArray(content)
    ? content.map((msg) => (msg.type === 'text' ? msg.text : '')).join('')
    : String(content || '');
  return Math.ceil(inputText.length / CHARS_PER_TOKEN);
};

/**
 * Fast token estimation for messages array
 */
export const estimateMessagesTokens = (messages: BaseMessage[] = []): number => {
  return messages.reduce((sum, message) => sum + estimateToken(message.content), 0);
};

/**
 * Fast content truncation using character-based estimation.
 * Strategy: Keep head (70%) and tail (30%), remove middle part.
 * Much faster than exact truncation as it avoids tokenization.
 */
export const truncateContentFast = (content: string, targetTokens: number): string => {
  const estimatedCurrentTokens = Math.ceil(content.length / CHARS_PER_TOKEN);

  if (estimatedCurrentTokens <= targetTokens) {
    return content;
  }

  // Strategy: Keep 70% at head, 30% at tail
  const headRatio = 0.7;
  const tailRatio = 0.3;

  // Reserve tokens for truncation message
  const truncationMessageTokens = 50;
  if (targetTokens <= truncationMessageTokens) {
    // Target too small, return minimal content
    const targetChars = Math.floor(targetTokens * CHARS_PER_TOKEN);
    return content.substring(0, Math.min(content.length, targetChars));
  }

  const availableTokens = targetTokens - truncationMessageTokens;
  const headTargetChars = Math.floor(availableTokens * headRatio * CHARS_PER_TOKEN);
  const tailTargetChars = Math.floor(availableTokens * tailRatio * CHARS_PER_TOKEN);

  const headContent = content.substring(0, headTargetChars);
  const tailContent = content.substring(content.length - tailTargetChars);
  const removedChars = content.length - headTargetChars - tailTargetChars;
  const removedTokensEstimate = Math.ceil(removedChars / CHARS_PER_TOKEN);

  return `${headContent}\n\n[... Truncated ${removedChars} chars (≈${removedTokensEstimate} tokens) ...]\n\n${tailContent}`;
};

// ============================================================================
// Exact Token Counting (Slow but accurate)
// ============================================================================

/**
 * Count tokens in MessageContent (supports both string and array formats)
 */
export const countToken = (content: MessageContent) => {
  const inputText = Array.isArray(content)
    ? content.map((msg) => (msg.type === 'text' ? msg.text : '')).join('')
    : String(content || '');
  return encode(inputText).length;
};

export const checkHasContext = (context: SkillContext) => {
  return context?.files?.length > 0 || context?.results?.length > 0;
};

export const countMessagesTokens = (messages: BaseMessage[] = []) => {
  return messages.reduce((sum, message) => sum + countToken(message.content), 0);
};

/**
 * Truncate content to target token count
 * Re-export from @refly/utils for consistency
 */
export const truncateContent = baseTruncateContent;
