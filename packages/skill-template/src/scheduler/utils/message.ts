import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

export interface SkillPromptModule {
  buildSystemPrompt: (locale: string, needPrepareContext: boolean) => string;
  buildContextUserPrompt: (context: string, needPrepareContext: boolean) => string;
  buildUserPrompt: ({
    originalQuery,
    optimizedQuery,
    rewrittenQueries,
    locale,
  }: {
    originalQuery: string;
    optimizedQuery: string;
    rewrittenQueries: string[];
    locale: string;
  }) => string;
}

export const buildFinalRequestMessages = ({
  module,
  locale,
  chatHistory,
  messages,
  needPrepareContext,
  context,
  images,
  originalQuery,
  optimizedQuery,
  rewrittenQueries,
}: {
  module: SkillPromptModule;
  locale: string;
  chatHistory: BaseMessage[];
  messages: BaseMessage[];
  needPrepareContext: boolean;
  context: string;
  images: string[];
  originalQuery: string;
  optimizedQuery: string;
  rewrittenQueries?: string[];
}) => {
  const systemPrompt = module.buildSystemPrompt(locale, needPrepareContext);
  const contextUserPrompt = module.buildContextUserPrompt?.(context, needPrepareContext) || '';
  const userPrompt = module.buildUserPrompt({
    originalQuery,
    optimizedQuery,
    rewrittenQueries,
    locale,
  });

  const contextMessages = contextUserPrompt ? [new HumanMessage(contextUserPrompt)] : [];

  const requestMessages = [
    new SystemMessage(systemPrompt),
    ...chatHistory,
    ...messages,
    ...contextMessages,
    new HumanMessage(
      images?.length
        ? {
            content: [
              { type: 'text', text: userPrompt },
              ...(images.map((image) => ({ type: 'image_url', image_url: { url: image } })) || []),
            ],
          }
        : userPrompt,
    ),
  ];

  return requestMessages;
};
