import { encode } from 'gpt-tokenizer';
import { BaseMessage, MessageContent } from '@langchain/core/messages';
import { SkillContext } from '@refly/openapi-schema';
import { truncateContent as baseTruncateContent } from '@refly/utils';

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
 * Estimate tokens in MessageContent using character-based heuristic
 * Faster than exact counting, useful for preliminary checks
 * Assumes ~4 characters per token for English, ~2 for Chinese/CJK
 */
export const estimateTokens = (content: MessageContent): number => {
  const inputText = Array.isArray(content)
    ? content.map((msg) => (msg.type === 'text' ? msg.text : '')).join('')
    : String(content || '');

  if (!inputText) return 0;

  // Count CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkMatches = inputText.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Non-CJK characters
  const nonCjkCount = inputText.length - cjkCount;

  // CJK: ~1.5 tokens per character, Non-CJK: ~0.25 tokens per character (4 chars per token)
  return Math.ceil(cjkCount * 1.5 + nonCjkCount * 0.25);
};

/**
 * Estimate total tokens in messages array using character-based heuristic
 * Faster than exact counting for large message arrays
 */
export const estimateMessagesTokens = (messages: BaseMessage[] = []): number => {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
};

/**
 * Truncate content to target token count
 * Re-export from @refly/utils for consistency
 */
export const truncateContent = baseTruncateContent;
