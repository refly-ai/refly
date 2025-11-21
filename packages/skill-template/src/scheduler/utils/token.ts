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
