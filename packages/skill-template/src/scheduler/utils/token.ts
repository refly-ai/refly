import { IContext } from '../types';
import { encode } from 'gpt-tokenizer';
import { BaseMessage, MessageContent } from '@langchain/core/messages';
import {
  SkillContextDocumentItem,
  SkillContextContentItem,
  SkillContextResourceItem,
  Source,
  SkillContext,
} from '@refly/openapi-schema';

export const countToken = (content: MessageContent) => {
  const inputText = Array.isArray(content)
    ? content.map((msg) => (msg.type === 'text' ? msg.text : '')).join('')
    : String(content || '');
  return encode(inputText).length;
};

export const countContentTokens = (contentList: SkillContextContentItem[] = []) => {
  return contentList.reduce((sum, content) => sum + countToken(content?.content || ''), 0);
};

export const countResourceTokens = (resources: SkillContextResourceItem[] = []) => {
  return resources.reduce((sum, resource) => sum + countToken(resource?.resource?.content), 0);
};

export const countDocumentTokens = (documents: SkillContextDocumentItem[] = []) => {
  return documents.reduce((sum, document) => sum + countToken(document?.document?.content), 0);
};

export const countSourcesTokens = (sources: Source[] = []) => {
  return sources.reduce((sum, source) => sum + countToken(source?.pageContent), 0);
};

// Keep the old function for backward compatibility
export const countWebSearchContextTokens = countSourcesTokens;

export const countContextTokens = (context: IContext) => {
  return (
    countContentTokens(context?.contentList) +
    countResourceTokens(context?.resources) +
    countDocumentTokens(context?.documents) +
    countSourcesTokens(context?.webSearchSources) +
    countSourcesTokens(context?.librarySearchSources)
  );
};

export const checkHasContext = (context: SkillContext) => {
  return (
    context?.contentList?.length > 0 ||
    context?.resources?.length > 0 ||
    context?.documents?.length > 0 ||
    context?.mediaList?.length > 0 ||
    context?.files?.length > 0 ||
    context?.results?.length > 0
  );
};

export const countMessagesTokens = (messages: BaseMessage[] = []) => {
  return messages.reduce((sum, message) => sum + countToken(message.content), 0);
};
