import { GraphState, IContext, MentionedContextItem, QueryAnalysis } from '../../types';
import { summarizeChatHistory, summarizeContext } from '../summarizer';
import { z } from 'zod';
import { BaseSkill, SkillRunnableConfig } from '../../../base';
import { SkillTemplateConfig } from '@refly-packages/openapi-schema';
import {
  MAX_CONTEXT_RATIO,
  MAX_QUERY_TOKENS_RATIO,
  DEFAULT_MODEL_CONTEXT_LIMIT,
} from '../constants';
import { truncateTextWithToken } from '../truncator';
import { safeStringifyJSON } from '@refly-packages/utils';
import { extractStructuredData } from '../extractor';
import { buildNormalQueryRewriteExamples, buildVagueQueryRewriteExamples } from './examples';

// simplify context entityId for better extraction
export const preprocessContext = (context: IContext): IContext => {
  const { resources = [], documents = [], contentList = [] } = context;

  const preprocessedContext = {
    resources: resources.map((r, index) => ({
      ...r,
      resource: { ...r.resource, resourceId: `resource-${index}` },
    })),
    documents: documents.map((c, index) => ({
      ...c,
      document: { ...c.document, docId: `document-${index}` },
    })),
    contentList: contentList.map((c, index) => ({
      ...c,
      metadata: { ...c.metadata, entityId: `content-${index}` },
    })),
  };

  return preprocessedContext;
};

export const postprocessContext = (
  mentionedContextList: MentionedContextItem[],
  originalContext: IContext,
): IContext => {
  const context: IContext = {
    resources: [],
    documents: [],
    contentList: [],
  };

  for (const item of mentionedContextList) {
    if (item.type === 'document') {
      // Find original document from originalContext by entityId
      const originalDocument = originalContext.documents.find(
        (_c, index) => `document-${index}` === item.entityId,
      );
      if (originalDocument) {
        context.documents.push({
          ...originalDocument,
          metadata: { ...originalDocument.metadata, useWholeContent: item?.useWholeContent },
        });
      }
    } else if (item.type === 'resource') {
      // Find original resource from originalContext by entityId
      const originalResource = originalContext.resources.find(
        (_r, index) => `resource-${index}` === item.entityId,
      );
      if (originalResource) {
        context.resources.push({
          ...originalResource,
          metadata: { ...originalResource.metadata, useWholeContent: item?.useWholeContent },
        });
      }
    } else if (item.type === 'selectedContent') {
      // Find original selectedContent from originalContext by entityId
      const originalSelectedContent = originalContext.contentList.find(
        (_c, index) => `content-${index}` === item.entityId,
      );
      if (originalSelectedContent) {
        context.contentList.push({
          ...originalSelectedContent,
          metadata: { ...originalSelectedContent.metadata, useWholeContent: item?.useWholeContent },
        });
      }
    }
  }

  return context;
};

// Add schema for query analysis
const queryAnalysisSchema = z.object({
  analysis: z
    .object({
      queryAnalysis: z.string().describe('Understanding of the search intent and context'),
      queryRewriteStrategy: z.string().describe('Strategy for query optimization'),
      summary: z.string().describe('One-sentence summary of user core goal with context'),
    })
    .describe('Analysis of the search query'),

  rewrittenQueries: z.array(z.string()).describe('Original query rewritten into focused aspects'),

  mentionedContext: z
    .array(
      z.object({
        type: z.enum(['document', 'resource', 'selectedContent']),
        entityId: z.string().optional(),
        title: z.string(),
        useWholeContent: z.boolean(),
      }),
    )
    .describe('Array of referenced context items'),
});

export async function analyzeQueryAndContext(
  query: string,
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState;
    tplConfig: SkillTemplateConfig;
  },
): Promise<QueryAnalysis> {
  // set current step
  ctx.config.metadata.step = { name: 'analyzeContext' };

  const { chatHistory, resources, documents, contentList, modelInfo } = ctx.config.configurable;
  const context: IContext = {
    resources,
    documents,
    contentList,
  };

  // Preprocess context for better extract mentioned context
  const preprocessedContext = preprocessContext(context);
  const maxContextTokens = modelInfo.contextLimit * MAX_CONTEXT_RATIO;
  const summarizedContext = summarizeContext(preprocessedContext, maxContextTokens);

  // Summarize chat history
  const summarizedChatHistory = summarizeChatHistory(chatHistory || []);

  const systemPrompt = `You are an AI query analyzer that preserves the original query intent while only clarifying referenced entities when necessary.

## Core Principles
1. HIGHEST PRIORITY: Original Query Intent
   - NEVER modify the query's fundamental purpose or action
   - Keep original verbs and commands intact
   - Maintain user's original expression style
   - If query is clear, DO NOT rewrite at all

2. Context & Chat History Usage
   - Context Format: XML tags for different content types
     <ContextItem type='document|resource|selectedContent' entityId='...' title='...'>content</ContextItem>
   
   - Chat History Format: XML tags for conversation flow
     <ChatHistory>
       <ChatHistoryItem type={human}>user message</ChatHistoryItem>
       <ChatHistoryItem type={ai}>assistant response</ChatHistoryItem>
     </ChatHistory>

   - When to Use Chat History:
     * ONLY when query directly references previous conversation
     * ONLY when query contains ambiguous references like "as mentioned before", "like you said"
     * IGNORE chat history if query is self-contained or unrelated

3. Query Analysis & Rewrite Strategy
   - Analyze query intent and context comprehensively
   - Generate multiple focused sub-queries for different aspects
   - Create a concise summary of user's core goal
   - Identify and link relevant context items
   - Maintain technical terms and domain-specific language

4. When to Rewrite
   - Query contains ambiguous references ("this/it/that") to context or chat history
   - Query implicitly refers to selected content
   - Query needs entity specification
   - Query references previous conversation without clear context
   - Query can be broken down into multiple focused aspects

5. When NOT to Rewrite
   - Query is already specific and clear
   - Context and chat history are unrelated to query
   - Query explicitly states its target

## Examples
${buildVagueQueryRewriteExamples()}

${buildNormalQueryRewriteExamples()}
`;

  const userMessage = `## User Query
${query}

## Available Context:
${summarizedContext}

## Recent Chat History:
${summarizedChatHistory}

Please analyze the query, focusing primarily on the current query and available context. Only consider the chat history if it's directly relevant to understanding the current query.`;

  const model = ctx.ctxThis.engine.chatModel({ temperature: 0.3 }, true);

  try {
    const result = await extractStructuredData(
      model,
      queryAnalysisSchema,
      `${systemPrompt}\n\n${userMessage}`,
      ctx.config,
      3, // maxRetries
      ctx?.config?.configurable?.modelInfo,
    );

    ctx.ctxThis.engine.logger.log(`- Query Analysis: ${result.analysis.queryAnalysis}
    - Rewrite Strategy: ${result.analysis.queryRewriteStrategy}
    - Summary: ${result.analysis.summary}
    - Rewritten Queries: ${safeStringifyJSON(result.rewrittenQueries)}
    - Mentioned Context: ${safeStringifyJSON(result.mentionedContext)}
    `);

    const optimizedQuery = result?.analysis?.summary || query;

    return {
      optimizedQuery,
      mentionedContext: postprocessContext(result?.mentionedContext, context),
      rewrittenQueries: [optimizedQuery, query, ...(result?.rewrittenQueries || [])],
      analysis: {
        queryAnalysis: result?.analysis?.queryAnalysis ?? 'Query analysis not available',
        queryRewriteStrategy:
          result?.analysis?.queryRewriteStrategy ?? 'No rewrite strategy applied',
        summary: result?.analysis?.summary ?? query,
      },
    };
  } catch (error) {
    ctx.ctxThis.engine.logger.error(`Failed to analyze query: ${error}`);
    // Return original query if analysis fails
    return {
      optimizedQuery: query,
      mentionedContext: { resources: [], documents: [], contentList: [] },
      rewrittenQueries: [query],
      analysis: {
        queryAnalysis: 'Analysis failed',
        queryRewriteStrategy: 'Using original query',
        summary: query,
      },
    };
  }
}

export const preprocessQuery = (
  query: string,
  ctx: {
    config: SkillRunnableConfig;
    ctxThis: BaseSkill;
    state: GraphState;
    tplConfig: SkillTemplateConfig;
  },
) => {
  const { modelInfo } = ctx.config.configurable;
  const maxQueryTokens =
    (modelInfo.contextLimit || DEFAULT_MODEL_CONTEXT_LIMIT) * MAX_QUERY_TOKENS_RATIO;

  return truncateTextWithToken(query, maxQueryTokens);
};
