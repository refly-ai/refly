import { Injectable, Logger } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { CanvasService } from '../canvas/canvas.service';
import { genCanvasID } from '@refly/utils';

@Injectable()
export class DailyNewsWorkflowService {
  private readonly logger = new Logger(DailyNewsWorkflowService.name);

  constructor(private readonly canvasService: CanvasService) {}

  /**
   * Create Daily AI News Digest workflow canvas with predefined nodes
   */
  async createDailyNewsWorkflow(user: User, websiteUrl?: string) {
    const canvasId = genCanvasID();

    // Define the 8-step enhanced workflow nodes
    const workflowNodes = [
      // Start Node: Daily News Initializer
      {
        id: 'daily-news-start',
        type: 'dailyNewsStart',
        position: { x: 100, y: 350 },
        data: {
          title: 'Daily AI News Digest Initializer',
          entityId: 'daily-news-initializer',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            variableInputs: {
              websiteUrl: websiteUrl || 'https://api.perplexity.ai',
              scheduleTime: '09:00',
              emailRecipient: '',
              newsCategories: 'artificial intelligence, machine learning, LLM, AI research',
            },
          },
        },
      },
      // Step 1: Schedule Daily Trigger
      {
        id: 'schedule-step',
        type: 'skillResponse',
        position: { x: 360, y: 120 },
        data: {
          title: 'Schedule Daily Trigger',
          entityId: 'schedule-daily-trigger',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 1 of 8. Schedule this workflow to run daily at configured time. Confirm timezone, execution reliability, and handling of missed runs. Output scheduling configuration and next run timestamp.',
            },
            selectedToolsets: [],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.1,
            maxTokens: 4000,
          },
        },
      },
      // Step 2: Fetch AI News Headlines
      {
        id: 'perplexity-fetch-step',
        type: 'skillResponse',
        position: { x: 640, y: 120 },
        data: {
          title: 'Perplexity AI News Fetcher',
          entityId: 'perplexity-news-fetcher',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 2 of 8. Use Perplexity at configured websiteUrl to search for AI news headlines from the past 24 hours focusing on specified news categories. Return structured JSON with title, summary, url, publishTime, category. Limit to top 12 high-quality sources from reliable publishers.',
            },
            selectedToolsets: [
              {
                type: 'regular',
                id: 'builtin',
                name: 'Builtin',
                toolset: {
                  toolsetId: 'builtin',
                  name: 'Builtin',
                },
              },
            ],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.2,
            maxTokens: 4000,
          },
        },
      },
      // Step 3: Structured News Extractor
      {
        id: 'content-extractor-step',
        type: 'skillResponse',
        position: { x: 920, y: 120 },
        data: {
          title: 'Structured News Extractor',
          entityId: 'structured-news-extractor',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 3 of 8. Ingest the Perplexity fetch results and extract article bodies via read-only browsing if needed. Produce clean markdown content with sections per article, preserving citations and source URLs.',
            },
            selectedToolsets: [
              {
                type: 'regular',
                id: 'builtin',
                name: 'Builtin',
                toolset: {
                  toolsetId: 'builtin',
                  name: 'Builtin',
                },
              },
            ],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.2,
            maxTokens: 4000,
          },
        },
      },
      // Step 4: News Quality Filter & Prioritizer
      {
        id: 'news-quality-filter',
        type: 'skillResponse',
        position: { x: 1060, y: 120 },
        data: {
          title: 'News Quality Filter & Prioritizer',
          entityId: 'news-quality-filter',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 4 of 8. Analyze and filter the extracted news content for quality and relevance. Apply filters: source credibility, content freshness, relevance to configured news categories, duplicate detection. Rank by importance and select top 8 articles for final digest.',
            },
            selectedToolsets: [],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.15,
            maxTokens: 4000,
          },
        },
      },
      // Step 5: Format News Digest
      {
        id: 'llm-format-step',
        type: 'skillResponse',
        position: { x: 1340, y: 120 },
        data: {
          title: 'Digest Formatter LLM',
          entityId: 'digest-formatter-llm',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 5 of 8. Transform the filtered content into a morning AI news digest email. Create sections: Headlines, Context & Analysis, What to Watch, Quick Links. Use concise, engaging tone with markdown formatting ready for email conversion.',
            },
            selectedToolsets: [],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.25,
            maxTokens: 4000,
          },
        },
      },
      // Step 6: Gmail Draft Composer
      {
        id: 'gmail-draft-step',
        type: 'skillResponse',
        position: { x: 1620, y: 120 },
        data: {
          title: 'Gmail Draft Composer',
          entityId: 'gmail-draft-composer',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 6 of 8. Draft a Gmail message addressed to configured recipient with subject "Daily AI News Digest - [Date]". Convert markdown to HTML and embed as email body. Include professional intro, unsubscribe reminder, and footer with timestamp.',
            },
            selectedToolsets: [
              {
                type: 'regular',
                id: 'builtin',
                name: 'Builtin',
                toolset: {
                  toolsetId: 'builtin',
                  name: 'Builtin',
                },
              },
            ],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.15,
            maxTokens: 4000,
          },
        },
      },
      // Step 7: Digest Approval & QA
      {
        id: 'approval-step',
        type: 'skillResponse',
        position: { x: 1900, y: 120 },
        data: {
          title: 'Digest Approval & QA',
          entityId: 'digest-approval-step',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 7 of 8. Present the Gmail draft summary to the user for approval. Highlight key news topics, detected issues, or missing data. Ask for any final edits before sending. Wait for manual confirmation to proceed with delivery.',
            },
            selectedToolsets: [],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.1,
            maxTokens: 4000,
          },
        },
      },
      // Step 8: Gmail Delivery
      {
        id: 'send-email-step',
        type: 'skillResponse',
        position: { x: 2180, y: 120 },
        data: {
          title: 'Gmail Delivery Agent',
          entityId: 'gmail-delivery-agent',
          metadata: {
            sizeMode: 'compact',
            status: 'ready',
            version: 0,
            contextItems: [],
            structuredData: {
              query:
                'Pilot Step Prompt: Step 8 of 8. After approval, send the Gmail digest using connected Gmail actions. Log message ID, delivery timestamp, and status. Provide delivery confirmation, analytics summary, and fallback instructions if send fails.',
            },
            selectedToolsets: [
              {
                type: 'regular',
                id: 'builtin',
                name: 'Builtin',
                toolset: {
                  toolsetId: 'builtin',
                  name: 'Builtin',
                },
              },
            ],
          },
          content: '',
          modelConfig: {
            model: 'kimi-k2',
            temperature: 0.05,
            maxTokens: 4000,
          },
        },
      },
    ];

    // Define connections between nodes
    const workflowEdges = [
      {
        id: 'edge-start-schedule',
        source: 'daily-news-start',
        target: 'schedule-step',
      },
      {
        id: 'edge-schedule-fetch',
        source: 'schedule-step',
        target: 'perplexity-fetch-step',
      },
      {
        id: 'edge-fetch-extract',
        source: 'perplexity-fetch-step',
        target: 'content-extractor-step',
      },
      {
        id: 'edge-extract-filter',
        source: 'content-extractor-step',
        target: 'news-quality-filter',
      },
      {
        id: 'edge-filter-format',
        source: 'news-quality-filter',
        target: 'llm-format-step',
      },
      {
        id: 'edge-format-draft',
        source: 'llm-format-step',
        target: 'gmail-draft-step',
      },
      {
        id: 'edge-draft-approval',
        source: 'gmail-draft-step',
        target: 'approval-step',
      },
      {
        id: 'edge-approval-send',
        source: 'approval-step',
        target: 'send-email-step',
      },
    ];

    // Create canvas state with nodes and edges
    const canvasState = {
      nodes: workflowNodes,
      edges: workflowEdges,
      viewport: { x: 0, y: 0, zoom: 0.8 },
    };

    // Create canvas with the workflow
    const canvas = await this.canvasService.createCanvasWithState(
      user,
      {
        canvasId,
        title: 'Daily AI News Digest with Perplexity and Gmail',
      },
      canvasState as any,
    );

    this.logger.log(`Created Daily AI News Digest workflow canvas: ${canvasId}`);

    return {
      canvasId,
      canvas,
      workflowSteps: [
        {
          id: 'step-1',
          title: 'Schedule Daily Trigger',
          description: 'Schedule the workflow to run daily at configured time.',
          nodeId: 'schedule-step',
          status: 'pending',
        },
        {
          id: 'step-2',
          title: 'Fetch AI News Headlines',
          description: 'Use Perplexity AI to search for AI news headlines from the last 24 hours.',
          nodeId: 'perplexity-fetch-step',
          status: 'pending',
        },
        {
          id: 'step-3',
          title: 'Extract News Content',
          description: 'Extract detailed content from news articles with citations.',
          nodeId: 'content-extractor-step',
          status: 'pending',
        },
        {
          id: 'step-4',
          title: 'Filter & Prioritize',
          description: 'Apply quality filters and rank news by relevance and importance.',
          nodeId: 'news-quality-filter',
          status: 'pending',
        },
        {
          id: 'step-5',
          title: 'Format News Digest',
          description: 'Transform filtered content into professional email format.',
          nodeId: 'llm-format-step',
          status: 'pending',
        },
        {
          id: 'step-6',
          title: 'Compose Gmail Draft',
          description: 'Create HTML email draft with proper formatting and structure.',
          nodeId: 'gmail-draft-step',
          status: 'pending',
        },
        {
          id: 'step-7',
          title: 'Review & Approve',
          description: 'Manual review checkpoint before sending the digest.',
          nodeId: 'approval-step',
          status: 'pending',
        },
        {
          id: 'step-8',
          title: 'Gmail Delivery',
          description: 'Send the approved digest and provide delivery confirmation.',
          nodeId: 'send-email-step',
          status: 'pending',
        },
      ],
    };
  }

  /**
   * Check if user input should trigger Daily AI News workflow
   */
  shouldTriggerDailyNewsWorkflow(userInput: string): boolean {
    const input = userInput.toLowerCase().trim();
    const triggerKeywords = [
      'daily ai news digest with perplexity and gmail',
      'daily ai news digest',
      'ai news digest',
      'perplexity gmail news',
      'automated ai newsletter',
    ];

    return triggerKeywords.some((keyword) => input.includes(keyword.toLowerCase()));
  }
}
