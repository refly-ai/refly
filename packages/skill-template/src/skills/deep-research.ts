import { START, END, StateGraphArgs, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { safeStringifyJSON, webSearchResultsToSources } from '@refly-packages/utils';
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
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { truncateTextWithToken } from '../scheduler/utils/truncator';
import { checkModelContextLenSupport } from '../scheduler/utils/model';
import * as deepResearchPrompts from '../scheduler/module/deep-research/prompt';
import {
  titleSchema,
  extractResultSchema,
  analysisSchema,
  researchPlanSchema,
} from '../scheduler/module/deep-research/schema';

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

  // Add researchState as a class property
  private researchState: {
    findings: Array<{ text: string; source: string }>;
    summaries: string[];
    currentDepth: number;
    completedSteps: number;
    totalExpectedSteps: number;
    currentTopic: string;
    plannedTopics: string[];
    failedAttempts: number;
    maxFailedAttempts: number;
    urlToSearch: string;
  } | null = null;

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

  private async addSource(source: Source, config: SkillRunnableConfig) {
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
    if (!this.researchState) {
      throw new Error('Research state not initialized');
    }

    try {
      // Add activity for search start
      await this.addActivity(
        {
          type: 'search',
          status: 'pending',
          message: `Searching for "${query}"`,
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );

      const searchResults = await this.engine.service.webSearch(config.configurable.user, {
        q: query,
        limit: 10,
      });

      if (!searchResults?.data) {
        // Handle search failure
        this.researchState.failedAttempts++;
        await this.addActivity(
          {
            type: 'search',
            status: 'error',
            message: `Search failed for "${query}" (Attempt ${this.researchState.failedAttempts} of ${this.researchState.maxFailedAttempts})`,
            depth: this.researchState.currentDepth,
          },
          this.researchState,
          config,
        );

        if (this.researchState.failedAttempts >= this.researchState.maxFailedAttempts) {
          throw new Error(`Search failed after ${this.researchState.maxFailedAttempts} attempts`);
        }
        throw new Error('Search failed');
      }

      const sources = webSearchResultsToSources(searchResults);

      // Reset failed attempts on success
      this.researchState.failedAttempts = 0;

      // Add activity for successful search
      await this.addActivity(
        {
          type: 'search',
          status: 'complete',
          message: `Found ${sources.length} relevant results`,
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );

      return {
        success: true,
        data: sources,
      };
    } catch (error) {
      // Handle any unexpected errors
      this.researchState.failedAttempts++;
      await this.addActivity(
        {
          type: 'search',
          status: 'error',
          message: `Search error: ${error.message} (Attempt ${this.researchState.failedAttempts} of ${this.researchState.maxFailedAttempts})`,
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );

      if (this.researchState.failedAttempts >= this.researchState.maxFailedAttempts) {
        throw new Error(`Search failed after ${this.researchState.maxFailedAttempts} attempts`);
      }
      throw error;
    }
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
        const response = await this.engine.service.extract(config.configurable.user, {
          url,
          query: topic,
          type: 'extract',
          options: {
            topic,
            maxLength: 5000,
          },
        });

        const extractedContent = response?.data?.[0]?.content;
        if (extractedContent) {
          const model = this.engine.chatModel({ temperature: 0.1 });
          const structuredContent = await extractStructuredData(
            model,
            extractResultSchema,
            `Structure the following extracted content with key points and metadata:
            URL: ${url}
            Content: ${extractedContent}
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
    if (!this.researchState) {
      throw new Error('Research state not initialized');
    }

    try {
      // Add activity for analysis start
      await this.addActivity(
        {
          type: 'analyze',
          status: 'pending',
          message: 'Analyzing findings and planning next steps',
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );

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

      // Add activity for successful analysis
      await this.addActivity(
        {
          type: 'analyze',
          status: 'complete',
          message: structuredAnalysis.summary,
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );

      return structuredAnalysis;
    } catch (error) {
      // Add activity for failed analysis
      await this.addActivity(
        {
          type: 'analyze',
          status: 'error',
          message: `Analysis error: ${error.message}`,
          depth: this.researchState.currentDepth,
        },
        this.researchState,
        config,
      );
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

    const model = this.engine.chatModel({ temperature: 0.1 });

    try {
      // Extract structured research plan
      const researchPlan = await extractStructuredData(
        model,
        researchPlanSchema,
        `${deepResearchPrompts.deepResearchSystemPrompt}

Research Topic/Question: ${query}

Based on this research topic, create a detailed research plan that includes:
1. Main topic clarification and scope
2. Key sub-topics to investigate
3. Research approach and methodology
4. Potential sources to prioritize

Please analyze the query thoroughly and provide a structured research plan.`,
        config,
        3,
        config?.configurable?.modelInfo,
      );

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

      // Log the research plan for debugging
      this.engine.logger.log(`Research Plan: ${safeStringifyJSON(researchPlan)}`);

      // Transform the structured plan into the expected return format
      return {
        initialTopic: researchPlan.mainTopic,
        plannedTopics: researchPlan.subTopics.map((topic) => topic.topic),
      };
    } catch (error) {
      this.engine.logger.error(`Failed to create research plan: ${error}`);
      // Fallback to using the original query if planning fails
      return {
        initialTopic: query,
        plannedTopics: [],
      };
    }
  }

  async performResearch(
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> {
    const { query } = state;
    const startTime = Date.now();
    const timeLimit = 4.5 * 60 * 1000;
    const maxDepth = 7;

    try {
      const { initialTopic, plannedTopics } = await this.analyzeQueryAndPlan(query, config);

      // Initialize researchState as class property
      this.researchState = {
        findings: [],
        summaries: [],
        currentDepth: 0,
        completedSteps: 0,
        totalExpectedSteps: maxDepth * 5,
        currentTopic: initialTopic,
        plannedTopics,
        failedAttempts: 0,
        maxFailedAttempts: 3,
        urlToSearch: '',
      };

      this.emitEvent(
        {
          structuredData: {
            type: 'progress-init',
            content: {
              maxDepth,
              totalSteps: this.researchState.totalExpectedSteps,
            },
          },
        },
        config,
      );

      while (this.researchState.currentDepth < maxDepth) {
        const timeElapsed = Date.now() - startTime;
        const timeRemaining = timeLimit - timeElapsed;

        if (timeElapsed >= timeLimit) {
          await this.addActivity(
            {
              type: 'thought',
              status: 'complete',
              message: 'Research stopped due to time limit',
              depth: this.researchState.currentDepth,
            },
            this.researchState,
            config,
          );
          break;
        }

        this.researchState.currentDepth++;

        // update depth and progress
        this.emitEvent(
          {
            structuredData: {
              type: 'depth-delta',
              content: {
                current: this.researchState.currentDepth,
                max: maxDepth,
                completedSteps: this.researchState.completedSteps,
                totalSteps: this.researchState.totalExpectedSteps,
              },
            },
          },
          config,
        );

        try {
          // search stage
          const searchResults = await this.search(this.researchState.currentTopic, config);

          // Add sources from search results
          for (const result of searchResults.data) {
            this.addSource(result, config);
          }

          // extract stage
          const topUrls = searchResults.data.slice(0, 3).map((r) => r.url);
          const extractions = await this.extractFromUrls(
            topUrls,
            this.researchState.currentTopic,
            this.researchState.currentDepth,
            this.researchState,
            config,
          );

          // analyze stage
          const analysis = await this.analyzeAndPlan(
            [...this.researchState.findings, ...extractions],
            this.researchState.currentTopic,
            timeRemaining,
            config,
          );

          // update research state
          this.researchState.findings.push(...extractions);
          if (analysis?.summary) {
            this.researchState.summaries.push(analysis.summary);
          }

          // check if continue
          if (!analysis?.shouldContinue || analysis?.gaps?.length === 0) {
            break;
          }

          // update next topic and urlToSearch
          this.researchState.currentTopic = analysis.nextSearchTopic || analysis.gaps[0];
          this.researchState.urlToSearch = analysis.urlToSearch || '';

          // Add thought activity for topic transition
          if (analysis.nextSearchTopic) {
            await this.addActivity(
              {
                type: 'thought',
                status: 'complete',
                message: `Moving to explore: ${analysis.nextSearchTopic}`,
                depth: this.researchState.currentDepth,
              },
              this.researchState,
              config,
            );
          }
        } catch (error) {
          await this.addActivity(
            {
              type: 'thought',
              status: 'error',
              message: `Error in research cycle: ${error.message}`,
              depth: this.researchState.currentDepth,
            },
            this.researchState,
            config,
          );

          if (this.researchState.failedAttempts >= this.researchState.maxFailedAttempts) {
            throw new Error(
              `Research failed after ${this.researchState.maxFailedAttempts} attempts`,
            );
          }
        }
      }

      // final synthesis
      const synthesisResult = await this.synthesize(
        query,
        this.researchState.findings,
        this.researchState.summaries,
        this.researchState.currentDepth,
        this.researchState,
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
      // handle error in research process
      if (this.researchState) {
        await this.addActivity(
          {
            type: 'thought',
            status: 'error',
            message: `Research failed: ${error.message}`,
            depth: this.researchState.currentDepth || 0,
          },
          this.researchState,
          config,
        );

        // if have partial result, try to return partial result
        if (this.researchState.findings.length > 0) {
          const partialSynthesis = await this.synthesize(
            query,
            this.researchState.findings,
            this.researchState.summaries,
            this.researchState.currentDepth,
            this.researchState,
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
      }

      throw error;
    } finally {
      // Clean up researchState
      this.researchState = null;
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
