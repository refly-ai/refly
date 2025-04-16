import { START, END, StateGraph } from '@langchain/langgraph';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { GraphState } from '../scheduler/types';
import { z } from 'zod';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { truncateMessages, truncateSource } from '../scheduler/utils/truncator';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly-packages/openapi-schema';
import { prepareContext } from '../scheduler/utils/context';

// Schema for recommended questions with reasoning
const recommendQuestionsSchema = z.object({
  recommended_questions: z
    .array(z.string().describe('A concise recommended question (10-30 characters)'))
    .min(3)
    .max(6)
    .describe('List of recommended questions'),
  reasoning: z.string().describe('Brief explanation of why these questions are recommended'),
});

export class RecommendQuestions extends BaseSkill {
  name = 'recommendQuestions';

  icon: Icon = { type: 'emoji', value: '❓' };

  description = 'Generate relevant recommended questions based on conversation context';

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'refresh',
        inputMode: 'switch',
        defaultValue: false,
        labelDict: {
          en: 'Refresh recommended questions',
          'zh-CN': '刷新推荐的提问',
        },
        descriptionDict: {
          en: 'Refresh the recommended questions',
          'zh-CN': '刷新推荐的提问',
        },
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  schema = z.object({
    query: z.string().describe('The query to recommend questions'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState = {
    ...baseStateGraphArgs,
  };

  // Main method to generate related questions
  genRecommendQuestions = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { messages = [], query } = state;
    const {
      locale = 'en',
      chatHistory = [],
      modelInfo,
      tplConfig,
      project,
    } = config.configurable || {};

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    // Process projectId based knowledge base search
    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId;

    // Update tplConfig with knowledge base search setting
    config.configurable.tplConfig = {
      ...config.configurable.tplConfig,
      enableKnowledgeBaseSearch: {
        value: enableKnowledgeBaseSearch,
        label: 'Knowledge Base Search',
        displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
      },
    };

    const isRefresh = tplConfig?.refresh?.value;

    // Process query and context using shared utilities
    const remainingTokens = modelInfo.contextLimit;

    // Truncate chat history with larger window for better context
    const usedChatHistory = truncateMessages(chatHistory, 10, 800, 4000);

    let context = '';
    let sources: Source[] = [];

    const needPrepareContext = remainingTokens > 0 && enableKnowledgeBaseSearch;

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: query,
          mentionedContext: {
            contentList: [],
            resources: [],
            documents: [],
          },
          maxTokens: remainingTokens,
          enableMentionedContext: true,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: {
            ...(config?.configurable?.tplConfig || {}),
            enableKnowledgeBaseSearch: {
              value: enableKnowledgeBaseSearch,
              label: 'Knowledge Base Search',
              displayValue: enableKnowledgeBaseSearch ? 'true' : 'false',
            },
          },
        },
      );

      context = preparedRes.contextStr;
      sources = preparedRes.sources;
    }

    // Generate title first
    config.metadata.step = { name: 'recommendQuestions' };

    const model = this.engine.chatModel({ temperature: 0.1 });

    // Build the system prompt with customInstructions if available
    const systemPrompt = `## Role
You are an expert at analyzing conversations and generating relevant recommended questions.

## Task
Generate 3 highly relevant recommended questions based on:
- Current query (if provided)
- Conversation history (if available)
- Previous recommendations feedback (if refresh requested)
${context ? '- Context information (if available)' : ''}

Each question should:
- Be concise (30-100 characters)
- Be contextually relevant
- Help deepen the conversation
- Be in the specified language: ${locale}

## Output Format
Generate questions with reasoning in JSON format:
{
  "recommended_questions": ["question1", "question2", "question3"],
  "reasoning": "Brief explanation of why these questions are recommended"
}

## Guidelines
- Questions should be specific and focused
- Avoid repetitive or overly general questions
- Ensure questions naturally flow from the conversation or query
- Provide clear reasoning for the questions' relevance
- Each question should be unique and specifically tailored
${
  isRefresh
    ? '- Generate completely different questions from previous ones as user requested refresh\n- Focus on alternative angles and perspectives'
    : ''
}

## Context Analysis Strategy
1. If query exists: Focus on exploring related aspects and diving deeper into the query topic
2. If chat history exists: Analyze conversation flow and suggest natural follow-up questions
${context ? '3. If context exists: Use context information to generate more informed and specific questions' : ''}
${context ? '4. If multiple sources exist: Combine insights to generate comprehensive questions' : ''}
${!context ? '3' : '5'}. If none exists: Generate engaging questions about general knowledge topics`;

    try {
      // Prepare messages for context
      const contextMessages = [...usedChatHistory, ...messages]
        .map((msg) => `${msg?.getType?.()}: ${msg.content}`)
        .join('\n');

      const contextPrompt = `${systemPrompt}

${query ? `CURRENT QUERY:\n${query}\n` : ''}
${contextMessages ? `CONVERSATION HISTORY:\n${contextMessages}\n` : ''}
${context ? `RELEVANT CONTEXT:\n${context}\n` : ''}
${
  isRefresh
    ? 'NOTE: User requested new recommendations. Please generate completely different questions from previous ones.\n'
    : ''
}
${
  !query && !contextMessages && !context
    ? 'NOTE: No context or query provided. Generate interesting general knowledge questions that could spark engaging conversations.\n'
    : ''
}

${customInstructions ? `## Custom Instructions:\n${customInstructions}\n` : ''}

Please generate relevant recommended questions in ${locale} language.`;

      if (sources.length > 0) {
        const truncatedSources = truncateSource(sources);
        await this.emitLargeDataEvent(
          {
            data: truncatedSources,
            buildEventData: (chunk, { isPartial, chunkIndex, totalChunks }) => ({
              structuredData: {
                sources: chunk,
                isPartial,
                chunkIndex,
                totalChunks,
              },
            }),
          },
          config,
        );
      }

      const result = await extractStructuredData(
        model,
        recommendQuestionsSchema,
        contextPrompt,
        config,
        3,
        modelInfo,
      );

      // Emit structured data including both questions and reasoning
      this.emitEvent(
        {
          structuredData: {
            recommendedQuestions: {
              questions: result.recommended_questions,
              locale,
            },
          },
        },
        config,
      );

      return {};
    } catch (error) {
      this.engine.logger.error(`Error generating recommended questions: ${error.stack}`);

      this.emitEvent(
        {
          structuredData: {
            recommendedQuestions: {
              questions: [],
              locale,
            },
          },
        },
        config,
      );

      throw error;
    }
  };

  // Convert to runnable workflow
  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('recommendQuestions', this.genRecommendQuestions)
      .addEdge(START, 'recommendQuestions')
      .addEdge('recommendQuestions', END);

    return workflow.compile();
  }
}
