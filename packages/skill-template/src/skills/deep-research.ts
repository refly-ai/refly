import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON } from '@refly-packages/utils';
import {
  Artifact,
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  Source,
} from '@refly-packages/openapi-schema';
// types
import { GraphState } from '../scheduler/types';
// utils
import { prepareContext } from '../scheduler/utils/context';
import { truncateMessages, truncateSource } from '../scheduler/utils/truncator';
import { countToken } from '../scheduler/utils/token';
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';
import { processQuery } from '../scheduler/utils/queryProcessor';

// prompts
import * as generateDocument from '../scheduler/module/generateDocument';
import { extractStructuredData } from '../scheduler/utils/extractor';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/dist/messages';
import { truncateTextWithToken } from '../scheduler/utils/truncator';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import * as deepResearchPrompts from '../scheduler/module/deep-research/prompt';

// Add title schema with reason
const titleSchema = z.object({
  title: z.string().describe('The document title based on user query and context'),
  description: z.string().optional().describe('A brief description of the document content'),
  reason: z.string().describe('The reasoning process for generating this title'),
});

// Define research step schemas with detailed descriptions
const searchResultSchema = z.object({
  title: z.string().describe('The title of the search result'),
  url: z.string().describe('The URL of the search result'),
  description: z.string().describe('A brief description of the search result content'),
  relevance: z.number().min(0).max(1).describe('Relevance score between 0 and 1'),
  confidence: z.number().min(0).max(1).describe('Confidence score of the result between 0 and 1'),
});

const extractResultSchema = z.object({
  url: z.string().describe('The URL of the extracted content'),
  content: z.string().describe('The extracted content from the URL'),
  keyPoints: z.array(z.string()).describe('Key points extracted from the content'),
  metadata: z
    .object({
      author: z.string().optional().describe('Author of the content if available'),
      date: z.string().optional().describe('Publication date if available'),
      source: z.string().describe('Source domain or platform'),
    })
    .describe('Additional metadata about the content'),
});

const analysisSchema = z.object({
  summary: z.string().describe('A comprehensive summary of the findings'),
  gaps: z.array(z.string()).describe('Identified gaps in the current research'),
  nextSteps: z.array(z.string()).describe('Recommended next steps for research'),
  shouldContinue: z.boolean().describe('Whether further research is needed'),
  nextSearchTopic: z.string().optional().describe('The next topic to search if continuing'),
  confidence: z
    .object({
      findings: z.number().min(0).max(1).describe('Confidence in the current findings'),
      gaps: z.number().min(0).max(1).describe('Confidence in identified gaps'),
      recommendations: z.number().min(0).max(1).describe('Confidence in next step recommendations'),
    })
    .describe('Confidence scores for different aspects of the analysis'),
});

export class DeepResearch extends BaseSkill {
  name = 'deepResearch';

  icon: Icon = { type: 'emoji', value: '�' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  invocationConfig: SkillInvocationConfig = {};

  description = 'Deep research on the user query';

  schema = z.object({
    query: z.string().optional().describe('The search query'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ) => {
    const { messages = [] } = state;
    const { locale = 'en', modelInfo } = config.configurable;
    const { tplConfig } = config?.configurable || {};

    // Use shared query processor
    const {
      optimizedQuery,
      query,
      usedChatHistory,
      hasContext,
      remainingTokens,
      mentionedContext,
    } = await processQuery({
      config,
      ctxThis: this,
      state,
    });

    let context = '';
    let sources: Source[] = [];

    const needPrepareContext = hasContext && remainingTokens > 0;
    const isModelContextLenSupport = checkModelContextLenSupport(modelInfo);
    this.engine.logger.log(`needPrepareContext: ${needPrepareContext}`);

    if (needPrepareContext) {
      config.metadata.step = { name: 'analyzeContext' };
      const preparedRes = await prepareContext(
        {
          query: optimizedQuery,
          mentionedContext,
          maxTokens: remainingTokens,
          enableMentionedContext: hasContext,
        },
        {
          config,
          ctxThis: this,
          state,
          tplConfig,
        },
      );

      context = preparedRes.contextStr;
      sources = preparedRes.sources;

      this.engine.logger.log(`context: ${safeStringifyJSON(context)}`);

      if (sources.length > 0) {
        this.emitEvent({ structuredData: { sources: truncateSource(sources) } }, config);
      }
    }

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      needPrepareContext: needPrepareContext && isModelContextLenSupport,
      context,
      originalQuery: query,
      rewrittenQuery: optimizedQuery,
    });

    this.engine.logger.log(`requestMessages: ${safeStringifyJSON(requestMessages)}`);

    return {
      optimizedQuery,
      requestMessages,
      context,
      sources,
      usedChatHistory,
    };
  };

  // Add new method to generate title
  generateTitle = async (
    state: GraphState,
    config: SkillRunnableConfig,
    { context, chatHistory }: { context: string; chatHistory: BaseMessage[] },
  ): Promise<string> => {
    const { query = '' } = state;
    const { locale = 'en', uiLocale = 'en' } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 });

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

    const titlePrompt = `${generateDocument.getTitlePrompt(locale, uiLocale)}

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
        titleSchema,
        titlePrompt,
        config,
        3, // Max retries
        config?.configurable?.modelInfo,
      );

      // Log the reasoning process
      this.engine.logger.log(`Title generation reason: ${result.reason}`);

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
      this.engine.logger.error(`Failed to generate title: ${error}`);
      return '';
    }
  };

  callGenerateDoc = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;

    const model = this.engine.chatModel({ temperature: 0.1 });

    const module = {
      buildSystemPrompt: generateDocument.buildGenerateDocumentSystemPrompt,
      buildUserPrompt: generateDocument.buildGenerateDocumentUserPrompt,
      buildContextUserPrompt: generateDocument.buildGenerateDocumentContextUserPrompt,
    };

    const { optimizedQuery, requestMessages, context, usedChatHistory } =
      await this.commonPreprocess(state, config, module);

    // Generate title first
    config.metadata.step = { name: 'generateTitle' };

    const documentTitle = await this.generateTitle(state, config, {
      context,
      chatHistory: usedChatHistory,
    });
    if (documentTitle) {
      this.emitEvent(
        {
          log: {
            key: 'generateTitle',
            descriptionArgs: { title: documentTitle },
          },
        },
        config,
      );
    } else {
      this.emitEvent({ log: { key: 'generateTitleFailed' } }, config);
    }

    // Create document with generated title
    const res = await this.engine.service.createDocument(user, {
      title: documentTitle || optimizedQuery,
      initialContent: '',
    });

    // Set current step
    config.metadata.step = { name: 'generateDocument' };

    const artifact: Artifact = {
      type: 'document',
      entityId: res.data?.docId || '',
      title: res.data?.title || '',
    };
    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'generating' },
      },
      config,
    );

    const responseMessage = await model.invoke(requestMessages, {
      ...config,
      metadata: {
        ...config.metadata,
        ...currentSkill,
        artifact,
      },
    });

    this.engine.logger.log(`responseMessage: ${safeStringifyJSON(responseMessage)}`);

    this.emitEvent(
      {
        event: 'artifact',
        artifact: { ...artifact, status: 'finish' },
      },
      config,
    );

    return { messages: [responseMessage] };
  };

  private async addActivity(
    activity: {
      type: 'search' | 'extract' | 'analyze' | 'reasoning' | 'synthesis' | 'thought';
      status: 'pending' | 'complete' | 'error';
      message: string;
      depth: number;
    },
    state: { completedSteps: number; totalExpectedSteps: number },
    config: SkillRunnableConfig,
  ) {
    const timestamp = new Date().toISOString();

    if (activity.status === 'complete') {
      state.completedSteps++;
    }

    this.emitEvent(
      {
        structuredData: {
          type: 'activity',
          content: {
            ...activity,
            timestamp,
            completedSteps: state.completedSteps,
            totalSteps: state.totalExpectedSteps,
          },
        },
      },
      config,
    );
  }

  private async addSource(
    source: {
      url: string;
      title: string;
      relevance: number;
    },
    config: SkillRunnableConfig,
  ) {
    this.emitEvent(
      {
        structuredData: {
          type: 'source-delta',
          content: source,
        },
      },
      config,
    );
  }

  private async search(query: string, config: SkillRunnableConfig) {
    const searchResults = await this.engine.service.search(config.configurable.user, {
      query,
      limit: 5,
    });

    if (!searchResults?.data) {
      throw new Error('Search failed');
    }

    const model = this.engine.chatModel({ temperature: 0.1 });
    const structuredResults = await extractStructuredData(
      model,
      z.array(searchResultSchema),
      `Analyze and structure the following search results:
      ${JSON.stringify(searchResults.data)}
      
      Provide a structured analysis of each result with relevance and confidence scores.`,
      config,
      3,
      config?.configurable?.modelInfo,
    );

    return {
      success: true,
      data: structuredResults,
    };
  }

  private async extractFromUrls(
    urls: string[],
    topic: string,
    depth: number,
    state: any,
    config: SkillRunnableConfig,
  ) {
    const extractPromises = urls.map(async (url) => {
      try {
        await this.addActivity(
          {
            type: 'extract',
            status: 'pending',
            message: `Analyzing ${new URL(url).hostname}`,
            depth,
          },
          state,
          config,
        );

        // Use the service's content extraction
        const response = await this.engine.service.processWebContent(config.configurable.user, {
          url,
          type: 'extract',
          options: {
            topic,
            maxLength: 5000,
          },
        });

        const content = response?.data?.content;

        if (content) {
          const model = this.engine.chatModel({ temperature: 0.1 });
          const structuredContent = await extractStructuredData(
            model,
            extractResultSchema,
            `Structure the following extracted content with key points and metadata:
            URL: ${url}
            Content: ${content}
            Topic: ${topic}
            
            Extract key information about the topic, focusing on facts, data, and expert opinions.`,
            config,
            3,
            config?.configurable?.modelInfo,
          );

          await this.addActivity(
            {
              type: 'extract',
              status: 'complete',
              message: `Extracted from ${new URL(url).hostname}`,
              depth,
            },
            state,
            config,
          );

          return {
            text: structuredContent.content,
            source: url,
          };
        }
        return null;
      } catch (error) {
        console.error('Extraction error:', error);
        return null;
      }
    });

    const results = await Promise.all(extractPromises);
    return results.filter(Boolean);
  }

  private async analyzeAndPlan(
    findings: Array<{ text: string; source: string }>,
    topic: string,
    timeRemaining: number,
    config: SkillRunnableConfig,
  ) {
    try {
      const timeRemainingMinutes = Math.round((timeRemaining / 1000 / 60) * 10) / 10;
      const model = this.engine.chatModel({ temperature: 0.1 });

      const prompt = `Analyze the research findings on topic: ${topic}
      Time remaining: ${timeRemainingMinutes} minutes
      
      Current findings:
      ${findings.map((f) => `[From ${f.source}]: ${f.text}`).join('\n')}
      
      Provide a structured analysis including summary, gaps, next steps, and confidence scores.`;

      const structuredAnalysis = await extractStructuredData(
        model,
        analysisSchema,
        prompt,
        config,
        3,
        config?.configurable?.modelInfo,
      );

      return structuredAnalysis;
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  }

  private async synthesize(
    query: string,
    findings: Array<{ text: string; source: string }>,
    summaries: string[],
    depth: number,
    state: { completedSteps: number; totalExpectedSteps: number },
    config: SkillRunnableConfig,
  ) {
    await this.addActivity(
      {
        type: 'synthesis',
        status: 'pending',
        message: 'Preparing final synthesis',
        depth,
      },
      state,
      config,
    );

    const model = this.engine.chatModel({ temperature: 0.7 });

    const synthesisResponse = await model.invoke([
      {
        role: 'system',
        content: `You are a research synthesis expert. Create a comprehensive research report that synthesizes all findings into a clear, well-structured document. 
        
        Requirements:
        1. Use clear headings and subheadings for better readability
        2. Cite sources when presenting key findings
        3. Highlight important insights and patterns
        4. Present balanced viewpoints and potential contradictions
        5. Discuss limitations and future research directions
        
        Focus on:
        - Main findings and key insights
        - Supporting evidence and credible sources
        - Connections between different pieces of information
        - Critical analysis and implications
        - Research limitations and future directions
        
        Format the output in markdown for better readability.`,
      },
      {
        role: 'user',
        content: `Research Topic: ${query}

        Findings from sources:
        ${findings.map((f) => `[Source: ${f.source}]\n${f.text}`).join('\n\n')}

        Progressive Research Summaries:
        ${summaries.join('\n\n')}
        
        Please synthesize these findings into a comprehensive research report.`,
      },
    ]);

    await this.addActivity(
      {
        type: 'synthesis',
        status: 'complete',
        message: 'Research completed',
        depth,
      },
      state,
      config,
    );

    return synthesisResponse.content;
  }

  private async analyzeQueryAndPlan(
    query: string,
    config: SkillRunnableConfig,
  ): Promise<{
    initialTopic: string;
    plannedTopics: string[];
  }> {
    // Initial planning phase
    await this.addActivity(
      {
        type: 'thought',
        status: 'pending',
        message: 'Analyzing research query and planning approach',
        depth: 0,
      },
      { completedSteps: 0, totalExpectedSteps: 1 },
      config,
    );

    // Analyze query and get initial plan
    const planningResult = await this.engine.chatModel({ temperature: 0.1 }).invoke([
      {
        role: 'system',
        content: deepResearchPrompts.deepResearchSystemPrompt,
      },
      {
        role: 'user',
        content: deepResearchPrompts.deepResearchPrompt(query),
      },
    ]);

    // Extract structured plan from discussion
    const researchPlan = await this.engine.chatModel({ temperature: 0.1 }).invoke([
      {
        role: 'system',
        content: 'Extract key research aspects and initial topics from the planning discussion.',
      },
      {
        role: 'user',
        content: planningResult.content,
      },
    ]);

    await this.addActivity(
      {
        type: 'thought',
        status: 'complete',
        message: 'Research plan created',
        depth: 0,
      },
      { completedSteps: 1, totalExpectedSteps: 1 },
      config,
    );

    // Update research plan parsing
    const topics = Array.isArray(researchPlan.content)
      ? researchPlan.content
          .map((item) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && 'text' in item) return item.text;
            return null;
          })
          .filter(Boolean)
      : typeof researchPlan.content === 'string'
        ? researchPlan.content.split('\n').filter(Boolean)
        : [];

    return {
      initialTopic: query,
      plannedTopics: topics,
    };
  }

  async performResearch(
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> {
    const { query } = state;
    const startTime = Date.now();
    const timeLimit = 4.5 * 60 * 1000;
    const maxDepth = 7;

    // 添加错误重试计数
    let failedAttempts = 0;
    const maxFailedAttempts = 3;
    let researchState: any;

    try {
      const { initialTopic, plannedTopics } = await this.analyzeQueryAndPlan(query, config);

      researchState = {
        findings: [] as Array<{ text: string; source: string }>,
        summaries: [] as string[],
        currentDepth: 0,
        completedSteps: 0,
        totalExpectedSteps: maxDepth * 5,
        currentTopic: initialTopic,
        plannedTopics,
        failedAttempts: 0,
      };

      this.emitEvent(
        {
          structuredData: {
            type: 'progress-init',
            content: {
              maxDepth,
              totalSteps: researchState.totalExpectedSteps,
            },
          },
        },
        config,
      );

      while (researchState.currentDepth < maxDepth) {
        const timeElapsed = Date.now() - startTime;
        const timeRemaining = timeLimit - timeElapsed;

        if (timeElapsed >= timeLimit) {
          await this.addActivity(
            {
              type: 'thought',
              status: 'complete',
              message: 'Research stopped due to time limit',
              depth: researchState.currentDepth,
            },
            researchState,
            config,
          );
          break;
        }

        researchState.currentDepth++;

        // 更新深度和进度
        this.emitEvent(
          {
            structuredData: {
              type: 'depth-delta',
              content: {
                current: researchState.currentDepth,
                max: maxDepth,
                completedSteps: researchState.completedSteps,
                totalSteps: researchState.totalExpectedSteps,
              },
            },
          },
          config,
        );

        try {
          // 搜索阶段
          const searchResults = await this.search(researchState.currentTopic, config);

          // 提取阶段
          const topUrls = searchResults.data.slice(0, 3).map((r) => r.url);
          const extractions = await this.extractFromUrls(
            topUrls,
            researchState.currentTopic,
            researchState.currentDepth,
            researchState,
            config,
          );

          // 分析阶段
          const analysis = await this.analyzeAndPlan(
            [...researchState.findings, ...extractions],
            researchState.currentTopic,
            timeRemaining,
            config,
          );

          // 更新研究状态
          researchState.findings.push(...extractions);
          if (analysis?.summary) {
            researchState.summaries.push(analysis.summary);
          }

          // 检查是否继续
          if (!analysis?.shouldContinue || analysis?.gaps?.length === 0) {
            break;
          }

          // 更新下一个主题
          researchState.currentTopic = analysis.nextSearchTopic || analysis.gaps[0];

          // 重置失败计数
          failedAttempts = 0;
        } catch (error) {
          failedAttempts++;
          await this.addActivity(
            {
              type: 'thought',
              status: 'error',
              message: `Error in research cycle: ${error.message}`,
              depth: researchState.currentDepth,
            },
            researchState,
            config,
          );

          if (failedAttempts >= maxFailedAttempts) {
            throw new Error(`Research failed after ${maxFailedAttempts} attempts`);
          }
        }
      }

      // 最终综合
      const synthesisResult = await this.synthesize(
        query,
        researchState.findings,
        researchState.summaries,
        researchState.currentDepth,
        researchState,
        config,
      );

      return {
        messages: [
          new AIMessage({
            content: synthesisResult,
          }),
        ],
      };
    } catch (error) {
      // 处理整体研究过程的错误
      await this.addActivity(
        {
          type: 'thought',
          status: 'error',
          message: `Research failed: ${error.message}`,
          depth: researchState?.currentDepth || 0,
        },
        { completedSteps: 0, totalExpectedSteps: maxDepth * 5 },
        config,
      );

      // 如果有部分结果，尝试返回部分结果
      if (researchState?.findings?.length > 0) {
        const partialSynthesis = await this.synthesize(
          query,
          researchState.findings,
          researchState.summaries,
          researchState.currentDepth,
          researchState,
          config,
        );

        return {
          messages: [
            new AIMessage({
              content: `Note: Research was incomplete due to errors.\n\n${partialSynthesis}`,
            }),
          ],
        };
      }

      throw error;
    }
  }

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('research', this.performResearch.bind(this))
      .addEdge(START, 'research')
      .addEdge('research', END);

    return workflow.compile();
  }
}
