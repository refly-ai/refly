import { SkillRunnableConfig } from '../../base';
import { GraphState } from '../types';

import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { SkillEngine } from '../../engine';

// TODO: human/assistant message 在保存时需要生成一个 summary，用于之后的感知上下文历史的持续对话时保留核心含义
export const getContextualQuestion = async (
  state: GraphState,
  config: SkillRunnableConfig,
  engine: SkillEngine,
) => {
  const { query, messages } = state;
  const { locale = 'en' } = config?.configurable || {};

  const getSystemPrompt = (locale: string) => `
## Target
Given a chat history and the latest user question
which might reference context in the chat history, formulate a standalone question
which can be understood without the chat history. Do NOT answer the question,
just reformulate it if needed and otherwise return it as is.

## Constraints
**Please output answer in ${locale} language.**
`;

  // 构建总结的 Prompt，将 question + chatHistory 总结成
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ['system', getSystemPrompt(locale)],
    new MessagesPlaceholder('chatHistory'),
    ['human', `The user's question is {question}, please output answer in ${locale} language:`],
  ]);
  const llm = engine.chatModel({ temperature: 0 }, true);
  const contextualizeQChain = contextualizeQPrompt.pipe(llm).pipe(new StringOutputParser());

  const contextualUserQuery = await contextualizeQChain.invoke({
    question: query,
    chatHistory: messages,
  });

  return { contextualUserQuery };
};
