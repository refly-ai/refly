import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Artifact,
} from '@refly-packages/openapi-schema';
import { GraphState } from '../scheduler/types';

// Import prompt sections
import { reactiveArtifactInstructions } from '../scheduler/module/artifacts/prompt';

// utils
import { buildFinalRequestMessages } from '../scheduler/utils/message';
import { prepareContext } from '../scheduler/utils/context';
import { processQuery } from '../scheduler/utils/queryProcessor';
import { extractAndCrawlUrls } from '../scheduler/utils/extract-weblink';
import { genCodeArtifactID, safeStringifyJSON } from '@refly-packages/utils';
import { truncateSource } from '../scheduler/utils/truncator';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import { processContextUrls } from '../utils/url-processing';

// Import prompt building functions - only import what we need
import {
  buildArtifactsUserPrompt,
  buildArtifactsContextUserPrompt,
  buildArtifactsSystemPrompt,
} from '../scheduler/module/artifacts';

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
    const { locale = 'en', modelInfo, tplConfig, project } = config.configurable;

    // Get project-specific customInstructions if available
    const customInstructions = project?.customInstructions;

    // process projectId based knowledge base search
    const projectId = project?.projectId;
    const enableKnowledgeBaseSearch = !!projectId;

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
      modelInfo: config.configurable.modelInfo,
      customInstructions,
    });

    return { requestMessages, sources, context, query };
  };

  callGenerateArtifact = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill } = config.configurable;

    // Preprocess the query
    const { requestMessages, sources, query } = await this.commonPreprocess(state, config);

    // Set current step
    config.metadata.step = { name: 'generateCodeArtifact' };

    // Create a code artifact entity
    const title = '';
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
}
