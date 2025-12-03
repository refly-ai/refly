import { encode } from 'gpt-tokenizer';
import { BaseMessage, MessageContent } from '@langchain/core/messages';
import { SkillContext } from '@refly/openapi-schema';

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
 * Strategy: Keep head (70%) and tail (30%), remove middle part
 */
export const truncateContent = (content: string, targetTokens: number): string => {
  const currentTokens = encode(content).length;

  if (currentTokens <= targetTokens) {
    return content;
  }

  // Strategy: Keep 70% at head, 30% at tail
  const headRatio = 0.7;
  const tailRatio = 0.3;

  // Reserve tokens for truncation message
  const truncationMessageTokens = 50;
  const availableTokens = targetTokens - truncationMessageTokens;

  const headTargetTokens = Math.floor(availableTokens * headRatio);
  const tailTargetTokens = Math.floor(availableTokens * tailRatio);

  // Initial estimate: 1 token ≈ 3 chars (conservative for mixed content)
  let headLength = Math.floor(headTargetTokens * 3);
  let tailLength = Math.floor(tailTargetTokens * 3);

  // Adjust head length to match target tokens (max 3 iterations)
  for (let i = 0; i < 3; i++) {
    const headContent = content.substring(0, headLength);
    const headTokens = encode(headContent).length;

    if (headTokens <= headTargetTokens) {
      break; // Good enough
    }
    // Too many tokens, reduce by the ratio
    headLength = Math.floor(headLength * (headTargetTokens / headTokens) * 0.95);
  }

  // Adjust tail length to match target tokens (max 3 iterations)
  for (let i = 0; i < 3; i++) {
    const tailContent = content.substring(content.length - tailLength);
    const tailTokens = encode(tailContent).length;

    if (tailTokens <= tailTargetTokens) {
      break; // Good enough
    }
    // Too many tokens, reduce by the ratio
    tailLength = Math.floor(tailLength * (tailTargetTokens / tailTokens) * 0.95);
  }

  const headContent = content.substring(0, headLength);
  const tailContent = content.substring(content.length - tailLength);
  const removedChars = content.length - headLength - tailLength;

  return `${headContent}\n\n[... Truncated ${removedChars} chars (≈${currentTokens - targetTokens} tokens) ...]\n\n${tailContent}`;
};
