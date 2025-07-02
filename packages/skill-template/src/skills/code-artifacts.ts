import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Artifact,
} from '@refly/openapi-schema';
import { GraphState } from '../scheduler/types';

// Import prompt sections
import { reactiveArtifactInstructions } from '../scheduler/module/artifacts/prompt';

// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { prepareContext } from '../scheduler/utils/context';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls } from '../scheduler/utils/extract-weblink';
import { genCodeArtifactID, safeStringifyJSON } from '@refly/utils';
import { truncateSource } from '../scheduler/utils/truncator';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import { processContextUrls } from '../utils/url-processing';

// Import prompt building functions - only import what we need
import {
  buildArtifactsUserPrompt,
  buildArtifactsContextUserPrompt,
  buildArtifactsSystemPrompt,
} from '../scheduler/module/artifacts';

import { extractStructuredData } from '../scheduler/utils/extractor';
import { BaseMessage, HumanMessage } from '@langchain/core/dist/messages';
import { truncateTextWithToken, truncateMessages } from '../scheduler/utils/truncator';
import { countToken } from '../scheduler/utils/token';

// Add title schema for code artifact
const codeArtifactTitleSchema = z.object({
  title: z.string().describe('The code artifact title based on user query and context'),
  description: z.string().optional().describe('A brief description of the component'),
  reason: z.string().describe('The reasoning process for generating this title'),
});

// Helper function to get artifact type options
const getArtifactTypeOptions = () => {
  return [
    { value: 'application/refly.artifacts.react', labelDict: { en: 'React', 'zh-CN': 'React' } },
    { value: 'image/svg+xml', labelDict: { en: 'SVG', 'zh-CN': 'SVG' } },
    {
      value: 'application/refly.artifacts.mermaid',
      labelDict: { en: 'Mermaid', 'zh-CN': 'Mermaid' },
    },
    { value: 'text/markdown', labelDict: { en: 'Markdown', 'zh-CN': 'Markdown' } },
    { value: 'application/refly.artifacts.code', labelDict: { en: 'Code', 'zh-CN': 'Code' } },
    { value: 'text/html', labelDict: { en: 'HTML', 'zh-CN': 'HTML' } },
    {
      value: 'application/refly.artifacts.mindmap',
      labelDict: { en: 'Mind Map', 'zh-CN': '思维导图' },
    },
  ];
};

/**
 * Code Artifacts Skill
 *
 * Generates React/TypeScript components for data visualization and interactive UIs
 */
export class CodeArtifacts extends BaseSkill {
  name = 'codeArtifacts';

  icon: Icon = { type: 'emoji', value: '🧩' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'artifactType',
        inputMode: 'select',
        defaultValue: 'auto',
        labelDict: {
          en: 'Artifact Type',
          'zh-CN': '组件类型',
        },
        descriptionDict: {
          en: 'Select the type of artifact to generate',
          'zh-CN': '选择要生成的组件类型',
        },
        options: [
          {
            value: 'auto',
            labelDict: { en: 'Auto Detect', 'zh-CN': '自动检测' },
          },
          ...getArtifactTypeOptions(),
        ],
      },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description =
    'Generate artifacts for the given query, including code snippets, html, svg, markdown, and more';

  schema = z.object({
    query: z.string().optional().describe('The request for generating an artifact'),
    images: z.array(z.string()).optional().describe('Reference images for the artifact'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  // Generate the full prompt by combining all sections
  generateFullPrompt = (): string => {
    return `${reactiveArtifactInstructions}`;
  };

  commonPreprocess = async (state: GraphState, config: SkillRunnableConfig) => {
    const { messages = [], images = [] } = state;
    const {
      locale = 'en',
      modelConfigMap,
      tplConfig,
      project,
      runtimeConfig,
    } = config.configurable;
    const modelInfo = modelConfigMap.chat;

    // Get project-specific customInstructions if available
    const customInstructions = project?.customInstructions;

    // Only enable knowledge base search if both projectId AND runtimeConfig.enabledKnowledgeBase are true
    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId && !!runtimeConfig?.enabledKnowledgeBase;

    this.engine.logger.log(
      `ProjectId: ${projectId}, Enable KB Search: ${enableKnowledgeBaseSearch}`,
    );

    // Get configuration values
    const artifactType = tplConfig?.artifactType?.value ?? 'auto';

    config.metadata.step = { name: 'analyzeQuery' };

    // Use shared query processor
    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
      rewrittenQueries,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    // Process URLs from frontend context if available
    const contextUrls = config.configurable?.urls || [];
    const contextUrlSources = await processContextUrls(contextUrls, config, this);

    // Combine contextUrlSources with other sources if needed
    if (contextUrlSources.length > 0) {
      // If you have existing sources array, you can combine them
      // sources = [...sources, ...contextUrlSources];
      this.engine.logger.log(`Added ${contextUrlSources.length} URL sources from context`);
    }

    // Extract URLs from the query and crawl them if needed
    const { sources: querySources, analysis } = await extractAndCrawlUrls(query, config, this, {
      concurrencyLimit: 5,
      batchSize: 8,
    });

    this.engine.logger.log(`URL extraction analysis: ${safeStringifyJSON(analysis)}`);
    this.engine.logger.log(`Extracted URL sources count: ${querySources.length}`);

    let context = '';
    let sources = [];

    const urlSources = [...contextUrlSources, ...querySources];

    // Consider URL sources for context preparation
    const hasUrlSources = urlSources.length > 0;
    const needPrepareContext =
      (hasContext || hasUrlSources || enableKnowledgeBaseSearch) && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelInfo);

    this.engine.logger.log(`optimizedQuery: ${optimizedQuery}`);
    this.engine.logger.log(`mentionedContext: ${safeStringifyJSON(mentionedContext)}`);
    this.engine.logger.log(`hasUrlSources: ${hasUrlSources}`);

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
          rewrittenQueries,
          urlSources,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig: {
            ...config.configurable.tplConfig,
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

    // Prepare additional instructions based on selected artifact type
    let typeInstructions = '';
    if (artifactType !== 'auto') {
      typeInstructions = `Please generate the artifact using the "${artifactType}" type specifically.`;
    }

    // Combine user instructions with type instructions
    const combinedInstructions = typeInstructions;

    // Custom module for building messages
    const module = {
      // Custom system prompt that includes examples
      buildSystemPrompt: () => {
        return buildArtifactsSystemPrompt();
      },
      buildContextUserPrompt: buildArtifactsContextUserPrompt,
      buildUserPrompt: ({ originalQuery, optimizedQuery, rewrittenQueries, locale }) => {
        return buildArtifactsUserPrompt({
          originalQuery,
          optimizedQuery,
          rewrittenQueries,
          customInstructions,
          locale,
        });
      },
    };

    // Modify query to include instructions if provided
    const enhancedQuery = combinedInstructions
      ? `${optimizedQuery}\n\n${combinedInstructions}`
      : optimizedQuery;
    const originalQuery = combinedInstructions ? `${query}\n\n${combinedInstructions}` : query;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: needPrepareContext && isModelContextLenSupport,
      context,
      images,
      originalQuery: originalQuery,
      optimizedQuery: enhancedQuery, // Use enhanced query with instructions
      rewrittenQueries,
      modelInfo,
      customInstructions,
    });

    return { requestMessages, sources, context, query, usedChatHistory };
  };

  callGenerateArtifact = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill } = config.configurable;

    // Preprocess the query
    const { requestMessages, sources, query, context, usedChatHistory } =
      await this.commonPreprocess(state, config);

    // Generate title first
    config.metadata.step = { name: 'generateTitle' };

    const codeArtifactTitle = await this.generateCodeArtifactTitle(state, config, {
      context,
      chatHistory: usedChatHistory,
    });
    this.engine.logger.log(`Generated code artifact title: ${codeArtifactTitle}`);

    if (codeArtifactTitle) {
      this.emitEvent(
        {
          log: { key: 'generateCodeArtifactTitle', descriptionArgs: { title: codeArtifactTitle } },
        },
        config,
      );
    } else {
      this.emitEvent({ log: { key: 'generateCodeArtifactTitleFailed' } }, config);
    }

    config.metadata.step = { name: 'generateCodeArtifact' };

    // Create a code artifact entity
    const title = codeArtifactTitle || '';
    const codeEntityId = genCodeArtifactID();

    // Create and emit the code artifact
    const artifact: Artifact = {
      type: 'codeArtifact',
      entityId: codeEntityId,
      title: title,
    };

    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'generating' },
      },
      config,
    );

    // Emit sources if available
    if (sources?.length > 0) {
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

    // Use a slightly higher temperature for more creative code generation
    const model = this.engine.chatModel({ temperature: 0.1 });

    // Let the front-end know we're generating an artifact
    this.emitEvent(
      {
        log: {
          key: 'generatingCodeArtifact',
          descriptionArgs: { query },
        },
      },
      config,
    );

    // Add specific configuration to metadata for the model
    const enhancedConfig = {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
        artifact,
      },
    };

    // Generate the response
    const responseMessage = await model.invoke(requestMessages, enhancedConfig);

    // Signal completion of artifact generation
    this.emitEvent(
      {
        log: {
          key: 'codeArtifactGenerated',
          descriptionArgs: { query },
        },
      },
      config,
    );

    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'finish' },
      },
      config,
    );

    return { messages: [responseMessage] };
  };

  toRunnable(): Runnable<any, any, RunnableConfig> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('generateArtifact', this.callGenerateArtifact);

    workflow.addEdge(START, 'generateArtifact');
    workflow.addEdge('generateArtifact', END);

    return workflow.compile();
  }

  // Generate title prompt specifically for code artifacts
  getCodeArtifactTitlePrompt = (locale: string, _uiLocale: string) => `
## Role
You are a code component title generation expert who creates clear, concise, and descriptive titles for React/TypeScript components.

## Task
Generate a component title based on the user's query${locale !== 'en' ? ` in ${locale} language` : ''}.

## Output Requirements
1. Title should be concise (preferably under 80 characters)
2. Title should clearly reflect the component's main purpose and functionality
3. Title should be in ${locale} language (preserve technical terms)
4. Use descriptive terms that indicate what the component does
5. Provide reasoning for the chosen title

## Output Format
Return a JSON object with:
- title: The generated title
- description (optional): Brief description of the component
- reason: Explanation of why this title was chosen

## Examples
- "Interactive Data Chart" for a chart component
- "User Registration Form" for a signup form
- "Real-time Chat Widget" for a chat component
- "Image Gallery Carousel" for an image slider
`;

  // Generate title for code artifact
  generateCodeArtifactTitle = async (
    state: GraphState,
    config: SkillRunnableConfig,
    { context, chatHistory }: { context: string; chatHistory: BaseMessage[] },
  ): Promise<string> => {
    const { query = '' } = state;
    const { locale = 'en', uiLocale = 'en', modelConfigMap } = config.configurable;
    const modelInfo = modelConfigMap.titleGeneration;

    const model = this.engine.chatModel({ temperature: 0.1 }, 'titleGeneration');

    // Prepare context snippet if available
    let contextSnippet = '';
    if (context) {
      const maxContextTokens = 300; // Target for ~200-400 tokens
      const tokens = countToken(context);
      if (tokens > maxContextTokens) {
        // Take first part of context up to token limit
        contextSnippet = truncateTextWithToken(context, maxContextTokens);
      } else {
        contextSnippet = context;
      }
    }

    // Prepare recent chat history
    const recentHistory = truncateMessages(chatHistory); // Limit chat history tokens

    const titlePrompt = `${this.getCodeArtifactTitlePrompt(locale, uiLocale)}

USER QUERY:
${query}

${
  contextSnippet
    ? `RELEVANT CONTEXT:
${contextSnippet}`
    : ''
}

${
  recentHistory.length > 0
    ? `RECENT CHAT HISTORY:
${recentHistory.map((msg) => `${(msg as HumanMessage)?.getType?.()}: ${msg.content}`).join('\n')}`
    : ''
}`;

    try {
      const result = await extractStructuredData(
        model,
        codeArtifactTitleSchema,
        titlePrompt,
        config,
        3, // Max retries
        modelInfo,
      );

      // Log the reasoning process
      this.engine.logger.log(`Code artifact title generation reason: ${result.reason}`);

      // Emit structured data for UI
      this.emitEvent(
        {
          structuredData: {
            titleGeneration: {
              title: result.title,
              description: result.description,
              reason: result.reason,
            },
          },
        },
        config,
      );

      return result.title;
    } catch (error) {
      this.engine.logger.error(`Failed to generate code artifact title: ${error}`);
      return '';
    }
  };
}
